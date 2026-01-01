import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminDisableUserCommand, AdminEnableUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { authenticateUser } from '../../shared/auth/middleware';
import { getDataSource } from '../../shared/db/data-source';
import { User, UserContactMethod, UserNotificationRule } from '../../shared/models';
import { logger } from '../../shared/utils/logger';
import {
  encryptCredential,
  decryptCredential,
  detectCredentialType,
  generateCredentialHint,
  validateCredential,
} from '../../shared/services/credential-encryption-service';

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
});

const UPLOADS_BUCKET = process.env.UPLOADS_BUCKET || 'pagerduty-lite-dev-uploads';

const router = Router();

// All routes require authentication
router.use(authenticateUser);

/**
 * GET /api/v1/users/me
 * Get current user profile
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const user = req.user!;

    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        phoneNumber: user.phoneNumber,
        profilePictureUrl: user.profilePictureUrl,
        settings: user.settings,
        organization: {
          id: user.organization.id,
          name: user.organization.name,
          plan: user.organization.plan,
        },
        // AI Diagnosis credential status
        aiCredentials: user.anthropicCredentialEncrypted ? {
          configured: true,
          type: user.anthropicCredentialType,
          hint: user.anthropicCredentialHint,
          updatedAt: user.anthropicCredentialUpdatedAt,
        } : {
          configured: false,
        },
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    logger.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

/**
 * PUT /api/v1/users/me
 * Update current user profile
 */
router.put(
  '/me',
  [
    body('fullName').optional().isString().isLength({ min: 2, max: 255 }).withMessage('Full name must be 2-255 characters'),
    body('phoneNumber').optional({ nullable: true }),
    body('displayName').optional({ nullable: true }).isString().isLength({ max: 50 }).withMessage('Display name max 50 characters'),
    body('timezone').optional().isString().withMessage('Timezone must be a string'),
    body('notificationPreferences').optional().isObject().withMessage('Notification preferences must be an object'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const user = req.user!;
      const { fullName, phoneNumber, displayName, timezone, notificationPreferences } = req.body;

      const dataSource = await getDataSource();
      const userRepo = dataSource.getRepository(User);

      // Build update object
      const updateData: Partial<User> = {};

      if (fullName !== undefined) {
        updateData.fullName = fullName;
      }

      if (phoneNumber !== undefined) {
        updateData.phoneNumber = phoneNumber || null;
      }

      // Handle settings updates (merge with existing)
      const currentSettings = user.settings || {};
      let settingsUpdated = false;

      if (displayName !== undefined) {
        currentSettings.profile = {
          ...currentSettings.profile,
          displayName: displayName || null,
        };
        settingsUpdated = true;
      }

      if (notificationPreferences !== undefined) {
        currentSettings.notificationPreferences = {
          ...currentSettings.notificationPreferences,
          ...notificationPreferences,
        };
        settingsUpdated = true;
      }

      if (timezone !== undefined) {
        currentSettings.profileTimezone = timezone;
        settingsUpdated = true;
      }

      if (settingsUpdated) {
        updateData.settings = currentSettings;
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      await userRepo.update(user.id, updateData);

      // Fetch updated user with organization
      const updatedUser = await userRepo.findOne({
        where: { id: user.id },
        relations: ['organization'],
      });

      logger.info('User profile updated', { userId: user.id });

      return res.json({
        message: 'Profile updated successfully',
        user: {
          id: updatedUser!.id,
          email: updatedUser!.email,
          fullName: updatedUser!.fullName,
          role: updatedUser!.role,
          phoneNumber: updatedUser!.phoneNumber,
          settings: updatedUser!.settings,
          organization: {
            id: updatedUser!.organization.id,
            name: updatedUser!.organization.name,
            plan: updatedUser!.organization.plan,
          },
          createdAt: updatedUser!.createdAt,
        },
      });
    } catch (error) {
      logger.error('Error updating user profile:', error);
      return res.status(500).json({ error: 'Failed to update profile' });
    }
  }
);

/**
 * GET /api/v1/users/me/availability
 * Get current user's availability settings
 */
router.get('/me/availability', async (req: Request, res: Response) => {
  try {
    const user = req.user!;

    const availability = user.settings?.availability || null;

    res.json({
      availability: availability ? {
        timezone: availability.timezone || 'UTC',
        weeklyHours: availability.weeklyHours || getDefaultWeeklyHours(),
        blackoutDates: availability.blackoutDates || [],
      } : null,
      hasAvailability: availability !== null,
    });
  } catch (error) {
    logger.error('Error fetching availability:', error);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

/**
 * PUT /api/v1/users/me/availability
 * Update current user's availability settings
 */
router.put(
  '/me/availability',
  [
    body('timezone').isString().notEmpty().withMessage('Timezone is required'),
    body('weeklyHours').isObject().withMessage('Weekly hours must be an object'),
    body('weeklyHours.*.available').optional().isBoolean(),
    body('weeklyHours.*.start').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid time format (use HH:mm)'),
    body('weeklyHours.*.end').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid time format (use HH:mm)'),
    body('blackoutDates').optional().isArray().withMessage('Blackout dates must be an array'),
    body('blackoutDates.*.start').optional().isISO8601().withMessage('Invalid date format'),
    body('blackoutDates.*.end').optional().isISO8601().withMessage('Invalid date format'),
    body('blackoutDates.*.reason').optional().isString(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const user = req.user!;
      const { timezone, weeklyHours, blackoutDates } = req.body;

      const dataSource = await getDataSource();
      const userRepo = dataSource.getRepository(User);

      // Update user settings with availability
      const currentSettings = user.settings || {};
      const updatedSettings = {
        ...currentSettings,
        availability: {
          timezone,
          weeklyHours,
          blackoutDates: blackoutDates || [],
        },
      };

      await userRepo.update(user.id, { settings: updatedSettings });

      logger.info('User availability updated', { userId: user.id, timezone });

      return res.json({
        message: 'Availability updated successfully',
        availability: {
          timezone,
          weeklyHours,
          blackoutDates: blackoutDates || [],
        },
      });
    } catch (error) {
      logger.error('Error updating availability:', error);
      return res.status(500).json({ error: 'Failed to update availability' });
    }
  }
);

/**
 * GET /api/v1/users
 * List users in the organization (with optional filters)
 * Admin-only route
 */
router.get(
  '/',
  [
    query('hasAvailability').optional().isBoolean().withMessage('hasAvailability must be a boolean'),
  ],
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;

      // Only admins can list users
      if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const orgId = req.orgId!;
      const hasAvailabilityFilter = req.query.hasAvailability === 'true';

      const dataSource = await getDataSource();
      const userRepo = dataSource.getRepository(User);

      const includeInactive = req.query.includeInactive === 'true';

      let users = await userRepo.find({
        where: includeInactive ? { orgId } : { orgId, status: 'active' },
        order: { fullName: 'ASC', email: 'ASC' },
      });

      // Filter users with availability if requested
      if (hasAvailabilityFilter) {
        users = users.filter(u => u.settings?.availability !== null && u.settings?.availability !== undefined);
      }

      return res.json({
        users: users.map(u => ({
          id: u.id,
          email: u.email,
          fullName: u.fullName,
          role: u.role,
          status: u.status,
          phoneNumber: u.phoneNumber,
          hasAvailability: u.settings?.availability !== null && u.settings?.availability !== undefined,
          availability: u.settings?.availability || null,
          createdAt: u.createdAt,
        })),
      });
    } catch (error) {
      logger.error('Error listing users:', error);
      return res.status(500).json({ error: 'Failed to list users' });
    }
  }
);

/**
 * PUT /api/v1/users/:id/role
 * Update user role (admin-only or for bootstrapping first admin)
 */
router.put(
  '/:id/role',
  [
    body('role').isIn(['admin', 'member']).withMessage('Role must be admin or member'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { role } = req.body;
      const currentUser = req.user!;
      const orgId = req.orgId!;

      const dataSource = await getDataSource();
      const userRepo = dataSource.getRepository(User);

      // Check if current user is admin (or if there are no admins yet - bootstrap case)
      const adminCount = await userRepo.count({
        where: { orgId, role: 'admin' },
      });

      if (adminCount > 0 && currentUser.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // Get target user
      const targetUser = await userRepo.findOne({
        where: { id, orgId },
      });

      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Update role
      await userRepo.update(id, { role });

      logger.info('User role updated', { userId: id, newRole: role, updatedBy: currentUser.id });

      return res.json({
        message: 'User role updated successfully',
        user: {
          id: targetUser.id,
          email: targetUser.email,
          fullName: targetUser.fullName,
          role,
        },
      });
    } catch (error) {
      logger.error('Error updating user role:', error);
      return res.status(500).json({ error: 'Failed to update user role' });
    }
  }
);

/**
 * POST /api/v1/users/invite
 * Invite a new user to the organization (admin-only)
 * Creates user in Cognito with temporary password and sends email
 */
router.post(
  '/invite',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('fullName').isString().notEmpty().withMessage('Full name is required'),
    body('role').optional().isIn(['admin', 'member']).withMessage('Role must be admin or member'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const currentUser = req.user!;
      const orgId = req.orgId!;

      // Only admins can invite users
      if (currentUser.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { email, fullName, role = 'member' } = req.body;

      const dataSource = await getDataSource();
      const userRepo = dataSource.getRepository(User);

      // Check if user already exists
      const existingUser = await userRepo.findOne({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ error: 'User with this email already exists' });
      }

      // Create user in Cognito with AdminCreateUserCommand
      // This sends a temporary password to the user's email
      logger.info('Creating invited user in Cognito', { email, invitedBy: currentUser.id });

      const createUserCommand = new AdminCreateUserCommand({
        UserPoolId: process.env.COGNITO_USER_POOL_ID!,
        Username: email,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'name', Value: fullName },
        ],
        DesiredDeliveryMediums: ['EMAIL'],
      });

      const cognitoResult = await cognitoClient.send(createUserCommand);
      const cognitoSub = cognitoResult.User?.Username || email;

      logger.info('Invited user created in Cognito', { email, cognitoSub });

      // Create user in database
      const user = userRepo.create({
        email,
        cognitoSub,
        fullName,
        orgId,
        role,
        status: 'active',
      });
      await userRepo.save(user);

      logger.info('Invited user created in database', { userId: user.id, email, invitedBy: currentUser.id });

      return res.status(201).json({
        message: 'User invited successfully. They will receive an email with login instructions.',
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          status: user.status,
          createdAt: user.createdAt,
        },
      });
    } catch (error: any) {
      logger.error('Error inviting user:', error);

      if (error.name === 'UsernameExistsException') {
        return res.status(400).json({ error: 'User with this email already exists in authentication system' });
      }

      return res.status(500).json({ error: 'Failed to invite user', details: error.message });
    }
  }
);

/**
 * PUT /api/v1/users/:id/status
 * Update user status (activate/deactivate) - admin-only
 */
router.put(
  '/:id/status',
  [
    body('status').isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { status } = req.body;
      const currentUser = req.user!;
      const orgId = req.orgId!;

      // Only admins can change user status
      if (currentUser.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // Prevent self-deactivation
      if (id === currentUser.id && status === 'inactive') {
        return res.status(400).json({ error: 'Cannot deactivate your own account' });
      }

      const dataSource = await getDataSource();
      const userRepo = dataSource.getRepository(User);

      const targetUser = await userRepo.findOne({
        where: { id, orgId },
      });

      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Update Cognito user status
      try {
        if (status === 'inactive') {
          const disableCommand = new AdminDisableUserCommand({
            UserPoolId: process.env.COGNITO_USER_POOL_ID!,
            Username: targetUser.email,
          });
          await cognitoClient.send(disableCommand);
        } else {
          const enableCommand = new AdminEnableUserCommand({
            UserPoolId: process.env.COGNITO_USER_POOL_ID!,
            Username: targetUser.email,
          });
          await cognitoClient.send(enableCommand);
        }
      } catch (cognitoError: any) {
        logger.error('Error updating Cognito user status:', cognitoError);
        // Continue with DB update even if Cognito fails (user might not exist in Cognito)
      }

      // Update database
      await userRepo.update(id, { status });

      logger.info('User status updated', { userId: id, newStatus: status, updatedBy: currentUser.id });

      return res.json({
        message: `User ${status === 'active' ? 'activated' : 'deactivated'} successfully`,
        user: {
          id: targetUser.id,
          email: targetUser.email,
          fullName: targetUser.fullName,
          role: targetUser.role,
          status,
        },
      });
    } catch (error) {
      logger.error('Error updating user status:', error);
      return res.status(500).json({ error: 'Failed to update user status' });
    }
  }
);

// ============================================
// AI Diagnosis Credential Management Endpoints
// ============================================

/**
 * GET /api/v1/users/me/anthropic-credentials
 * Get current user's Anthropic credential status
 */
router.get('/me/anthropic-credentials', async (req: Request, res: Response) => {
  try {
    const user = req.user!;

    if (!user.anthropicCredentialEncrypted) {
      return res.json({
        configured: false,
        message: 'No Anthropic credentials configured. Set up in Settings to enable AI Diagnosis.',
      });
    }

    return res.json({
      configured: true,
      type: user.anthropicCredentialType,
      hint: user.anthropicCredentialHint,
      hasRefreshToken: !!user.anthropicRefreshTokenEncrypted,
      updatedAt: user.anthropicCredentialUpdatedAt,
    });
  } catch (error) {
    logger.error('Error fetching credential status:', error);
    return res.status(500).json({ error: 'Failed to fetch credential status' });
  }
});

/**
 * POST /api/v1/users/me/anthropic-credentials
 * Add or update Anthropic credentials (API key or OAuth token)
 */
router.post(
  '/me/anthropic-credentials',
  [
    body('credential')
      .isString()
      .notEmpty()
      .withMessage('Credential is required')
      .matches(/^sk-ant-/)
      .withMessage('Invalid credential format. Must start with sk-ant-'),
    body('refreshToken')
      .optional()
      .isString()
      .matches(/^sk-ant-ort/)
      .withMessage('Invalid refresh token format'),
    body('skipValidation')
      .optional()
      .isBoolean()
      .withMessage('skipValidation must be boolean'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const user = req.user!;
      const { credential, refreshToken, skipValidation } = req.body;

      // Detect credential type
      const credentialType = detectCredentialType(credential);
      if (!credentialType) {
        return res.status(400).json({
          error: 'Unknown credential type. Use an API key (sk-ant-api...) or OAuth token (sk-ant-oat...).',
        });
      }

      // Validate credential unless skipped (useful for testing)
      if (!skipValidation) {
        logger.info('Validating Anthropic credential', { userId: user.id, type: credentialType });
        const isValid = await validateCredential(credential);
        if (!isValid) {
          return res.status(400).json({
            error: 'Invalid credential. Please check your API key or OAuth token and try again.',
          });
        }
      }

      // Encrypt and store
      const encryptedCredential = await encryptCredential(credential);
      const hint = generateCredentialHint(credential);

      // Encrypt refresh token if provided
      let encryptedRefreshToken: string | null = null;
      if (refreshToken) {
        encryptedRefreshToken = await encryptCredential(refreshToken);
      }

      const dataSource = await getDataSource();
      const userRepo = dataSource.getRepository(User);

      await userRepo.update(user.id, {
        anthropicCredentialEncrypted: encryptedCredential,
        anthropicCredentialType: credentialType,
        anthropicCredentialHint: hint,
        anthropicRefreshTokenEncrypted: encryptedRefreshToken,
        anthropicCredentialUpdatedAt: new Date(),
      });

      logger.info('Anthropic credential saved', { userId: user.id, type: credentialType });

      return res.json({
        message: 'Anthropic credentials saved successfully',
        credential: {
          type: credentialType,
          hint,
          hasRefreshToken: !!refreshToken,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Error saving credential:', error);
      return res.status(500).json({ error: 'Failed to save credentials' });
    }
  }
);

/**
 * DELETE /api/v1/users/me/anthropic-credentials
 * Remove Anthropic credentials
 */
router.delete('/me/anthropic-credentials', async (req: Request, res: Response) => {
  try {
    const user = req.user!;

    const dataSource = await getDataSource();
    const userRepo = dataSource.getRepository(User);

    await userRepo.update(user.id, {
      anthropicCredentialEncrypted: null,
      anthropicCredentialType: null,
      anthropicCredentialHint: null,
      anthropicRefreshTokenEncrypted: null,
      anthropicCredentialUpdatedAt: null,
    });

    logger.info('Anthropic credentials removed', { userId: user.id });

    return res.json({
      message: 'Anthropic credentials removed successfully',
    });
  } catch (error) {
    logger.error('Error removing credentials:', error);
    return res.status(500).json({ error: 'Failed to remove credentials' });
  }
});

/**
 * Helper function to get a user's decrypted Anthropic credential
 * Used internally by other services (AI diagnosis)
 */
export async function getUserAnthropicCredential(userId: string): Promise<string | null> {
  try {
    const dataSource = await getDataSource();
    const userRepo = dataSource.getRepository(User);

    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user?.anthropicCredentialEncrypted) {
      return null;
    }

    return await decryptCredential(user.anthropicCredentialEncrypted);
  } catch (error) {
    logger.error('Error decrypting user credential:', error);
    return null;
  }
}

/**
 * Helper function to get default weekly hours (9-5, Mon-Fri)
 */
function getDefaultWeeklyHours() {
  return {
    monday: { available: true, start: '09:00', end: '17:00' },
    tuesday: { available: true, start: '09:00', end: '17:00' },
    wednesday: { available: true, start: '09:00', end: '17:00' },
    thursday: { available: true, start: '09:00', end: '17:00' },
    friday: { available: true, start: '09:00', end: '17:00' },
    saturday: { available: false, start: '09:00', end: '17:00' },
    sunday: { available: false, start: '09:00', end: '17:00' },
  };
}

// ============================================
// User Contact Methods Endpoints
// ============================================

/**
 * GET /api/v1/users/me/contact-methods
 * Get current user's contact methods
 */
router.get('/me/contact-methods', async (req: Request, res: Response) => {
  try {
    const user = req.user!;

    const dataSource = await getDataSource();
    const contactMethodRepo = dataSource.getRepository(UserContactMethod);

    const contactMethods = await contactMethodRepo.find({
      where: { userId: user.id },
      order: { type: 'ASC', createdAt: 'ASC' },
    });

    return res.json({
      contactMethods: contactMethods.map(cm => ({
        id: cm.id,
        type: cm.type,
        address: cm.address,
        label: cm.label,
        verified: cm.verified,
        isDefault: cm.isDefault,
        createdAt: cm.createdAt,
      })),
    });
  } catch (error) {
    logger.error('Error fetching contact methods:', error);
    return res.status(500).json({ error: 'Failed to fetch contact methods' });
  }
});

/**
 * POST /api/v1/users/me/contact-methods
 * Add a new contact method
 */
router.post(
  '/me/contact-methods',
  [
    body('type').isIn(['email', 'sms', 'phone', 'push']).withMessage('Type must be email, sms, phone, or push'),
    body('address').isString().notEmpty().withMessage('Address is required'),
    body('label').optional().isString().isLength({ max: 100 }).withMessage('Label max 100 characters'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const user = req.user!;
      const { type, address, label } = req.body;

      const dataSource = await getDataSource();
      const contactMethodRepo = dataSource.getRepository(UserContactMethod);

      // Check for duplicate
      const existing = await contactMethodRepo.findOne({
        where: { userId: user.id, type, address },
      });
      if (existing) {
        return res.status(400).json({ error: 'This contact method already exists' });
      }

      // Check if this is the first of its type (make it default)
      const countOfType = await contactMethodRepo.count({
        where: { userId: user.id, type },
      });

      const contactMethod = contactMethodRepo.create({
        userId: user.id,
        type,
        address,
        label: label || null,
        verified: type === 'push', // Push methods are auto-verified
        isDefault: countOfType === 0,
      });

      await contactMethodRepo.save(contactMethod);

      logger.info('Contact method added', { userId: user.id, type, methodId: contactMethod.id });

      return res.status(201).json({
        message: 'Contact method added successfully',
        contactMethod: {
          id: contactMethod.id,
          type: contactMethod.type,
          address: contactMethod.address,
          label: contactMethod.label,
          verified: contactMethod.verified,
          isDefault: contactMethod.isDefault,
          createdAt: contactMethod.createdAt,
        },
      });
    } catch (error) {
      logger.error('Error adding contact method:', error);
      return res.status(500).json({ error: 'Failed to add contact method' });
    }
  }
);

/**
 * PUT /api/v1/users/me/contact-methods/:id
 * Update a contact method
 */
router.put(
  '/me/contact-methods/:id',
  [
    body('label').optional().isString().isLength({ max: 100 }).withMessage('Label max 100 characters'),
    body('isDefault').optional().isBoolean().withMessage('isDefault must be a boolean'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const user = req.user!;
      const { id } = req.params;
      const { label, isDefault } = req.body;

      const dataSource = await getDataSource();
      const contactMethodRepo = dataSource.getRepository(UserContactMethod);

      const contactMethod = await contactMethodRepo.findOne({
        where: { id, userId: user.id },
      });

      if (!contactMethod) {
        return res.status(404).json({ error: 'Contact method not found' });
      }

      if (label !== undefined) {
        contactMethod.label = label || null;
      }

      if (isDefault === true) {
        // Unset default for other methods of same type
        await contactMethodRepo.update(
          { userId: user.id, type: contactMethod.type },
          { isDefault: false }
        );
        contactMethod.isDefault = true;
      }

      await contactMethodRepo.save(contactMethod);

      logger.info('Contact method updated', { userId: user.id, methodId: id });

      return res.json({
        message: 'Contact method updated successfully',
        contactMethod: {
          id: contactMethod.id,
          type: contactMethod.type,
          address: contactMethod.address,
          label: contactMethod.label,
          verified: contactMethod.verified,
          isDefault: contactMethod.isDefault,
          createdAt: contactMethod.createdAt,
        },
      });
    } catch (error) {
      logger.error('Error updating contact method:', error);
      return res.status(500).json({ error: 'Failed to update contact method' });
    }
  }
);

/**
 * DELETE /api/v1/users/me/contact-methods/:id
 * Delete a contact method
 */
router.delete('/me/contact-methods/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    const dataSource = await getDataSource();
    const contactMethodRepo = dataSource.getRepository(UserContactMethod);

    const contactMethod = await contactMethodRepo.findOne({
      where: { id, userId: user.id },
    });

    if (!contactMethod) {
      return res.status(404).json({ error: 'Contact method not found' });
    }

    await contactMethodRepo.remove(contactMethod);

    logger.info('Contact method deleted', { userId: user.id, methodId: id });

    return res.json({ message: 'Contact method deleted successfully' });
  } catch (error) {
    logger.error('Error deleting contact method:', error);
    return res.status(500).json({ error: 'Failed to delete contact method' });
  }
});

/**
 * POST /api/v1/users/me/contact-methods/:id/verify
 * Send or confirm verification for a contact method
 */
router.post(
  '/me/contact-methods/:id/verify',
  [
    body('code').optional().isString().isLength({ min: 6, max: 6 }).withMessage('Code must be 6 characters'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const user = req.user!;
      const { id } = req.params;
      const { code } = req.body;

      const dataSource = await getDataSource();
      const contactMethodRepo = dataSource.getRepository(UserContactMethod);

      const contactMethod = await contactMethodRepo.findOne({
        where: { id, userId: user.id },
      });

      if (!contactMethod) {
        return res.status(404).json({ error: 'Contact method not found' });
      }

      if (contactMethod.verified) {
        return res.json({ message: 'Contact method is already verified', verified: true });
      }

      if (code) {
        // Verify with code
        const isValid = contactMethod.verify(code);
        if (!isValid) {
          return res.status(400).json({ error: 'Invalid verification code' });
        }

        await contactMethodRepo.save(contactMethod);

        logger.info('Contact method verified', { userId: user.id, methodId: id });

        return res.json({
          message: 'Contact method verified successfully',
          verified: true,
        });
      } else {
        // Send verification code
        // TODO: Use verificationCode to actually send verification email/SMS
        contactMethod.generateVerificationCode();
        await contactMethodRepo.save(contactMethod);

        // TODO: Actually send verification email/SMS
        // For now, just return success
        logger.info('Verification code generated', {
          userId: user.id,
          methodId: id,
          type: contactMethod.type,
          // Don't log the actual code in production
        });

        return res.json({
          message: 'Verification code sent',
          sentAt: contactMethod.verificationSentAt,
        });
      }
    } catch (error) {
      logger.error('Error verifying contact method:', error);
      return res.status(500).json({ error: 'Failed to verify contact method' });
    }
  }
);

// ============================================
// User Notification Rules Endpoints
// ============================================

/**
 * GET /api/v1/users/me/notification-rules
 * Get current user's notification rules
 */
router.get('/me/notification-rules', async (req: Request, res: Response) => {
  try {
    const user = req.user!;

    const dataSource = await getDataSource();
    const ruleRepo = dataSource.getRepository(UserNotificationRule);

    const rules = await ruleRepo.find({
      where: { userId: user.id },
      relations: ['contactMethod'],
      order: { urgency: 'ASC', ruleOrder: 'ASC' },
    });

    return res.json({
      notificationRules: rules.map(r => ({
        id: r.id,
        contactMethodId: r.contactMethodId,
        contactMethod: r.contactMethod ? {
          id: r.contactMethod.id,
          type: r.contactMethod.type,
          address: r.contactMethod.address,
          label: r.contactMethod.label,
        } : null,
        urgency: r.urgency,
        startDelayMinutes: r.startDelayMinutes,
        ruleOrder: r.ruleOrder,
        enabled: r.enabled,
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    logger.error('Error fetching notification rules:', error);
    return res.status(500).json({ error: 'Failed to fetch notification rules' });
  }
});

/**
 * POST /api/v1/users/me/notification-rules
 * Create a new notification rule
 */
router.post(
  '/me/notification-rules',
  [
    body('contactMethodId').isUUID().withMessage('Valid contact method ID is required'),
    body('urgency').isIn(['high', 'low', 'any']).withMessage('Urgency must be high, low, or any'),
    body('startDelayMinutes').optional().isInt({ min: 0 }).withMessage('Delay must be a non-negative integer'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const user = req.user!;
      const { contactMethodId, urgency, startDelayMinutes = 0 } = req.body;

      const dataSource = await getDataSource();
      const ruleRepo = dataSource.getRepository(UserNotificationRule);
      const contactMethodRepo = dataSource.getRepository(UserContactMethod);

      // Verify contact method belongs to user
      const contactMethod = await contactMethodRepo.findOne({
        where: { id: contactMethodId, userId: user.id },
      });

      if (!contactMethod) {
        return res.status(404).json({ error: 'Contact method not found' });
      }

      // Get max rule order for this urgency
      const maxOrderResult = await ruleRepo
        .createQueryBuilder('rule')
        .select('MAX(rule.ruleOrder)', 'max')
        .where('rule.userId = :userId AND rule.urgency = :urgency', { userId: user.id, urgency })
        .getRawOne();
      const ruleOrder = (maxOrderResult?.max ?? -1) + 1;

      const rule = ruleRepo.create({
        userId: user.id,
        contactMethodId,
        urgency,
        startDelayMinutes,
        ruleOrder,
        enabled: true,
      });

      await ruleRepo.save(rule);

      logger.info('Notification rule created', { userId: user.id, ruleId: rule.id });

      return res.status(201).json({
        message: 'Notification rule created successfully',
        notificationRule: {
          id: rule.id,
          contactMethodId: rule.contactMethodId,
          contactMethod: {
            id: contactMethod.id,
            type: contactMethod.type,
            address: contactMethod.address,
            label: contactMethod.label,
          },
          urgency: rule.urgency,
          startDelayMinutes: rule.startDelayMinutes,
          ruleOrder: rule.ruleOrder,
          enabled: rule.enabled,
          createdAt: rule.createdAt,
        },
      });
    } catch (error) {
      logger.error('Error creating notification rule:', error);
      return res.status(500).json({ error: 'Failed to create notification rule' });
    }
  }
);

/**
 * PUT /api/v1/users/me/notification-rules/:id
 * Update a notification rule
 */
router.put(
  '/me/notification-rules/:id',
  [
    body('urgency').optional().isIn(['high', 'low', 'any']).withMessage('Urgency must be high, low, or any'),
    body('startDelayMinutes').optional().isInt({ min: 0 }).withMessage('Delay must be a non-negative integer'),
    body('enabled').optional().isBoolean().withMessage('Enabled must be a boolean'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const user = req.user!;
      const { id } = req.params;
      const { urgency, startDelayMinutes, enabled } = req.body;

      const dataSource = await getDataSource();
      const ruleRepo = dataSource.getRepository(UserNotificationRule);

      const rule = await ruleRepo.findOne({
        where: { id, userId: user.id },
        relations: ['contactMethod'],
      });

      if (!rule) {
        return res.status(404).json({ error: 'Notification rule not found' });
      }

      if (urgency !== undefined) rule.urgency = urgency;
      if (startDelayMinutes !== undefined) rule.startDelayMinutes = startDelayMinutes;
      if (enabled !== undefined) rule.enabled = enabled;

      await ruleRepo.save(rule);

      logger.info('Notification rule updated', { userId: user.id, ruleId: id });

      return res.json({
        message: 'Notification rule updated successfully',
        notificationRule: {
          id: rule.id,
          contactMethodId: rule.contactMethodId,
          contactMethod: rule.contactMethod ? {
            id: rule.contactMethod.id,
            type: rule.contactMethod.type,
            address: rule.contactMethod.address,
            label: rule.contactMethod.label,
          } : null,
          urgency: rule.urgency,
          startDelayMinutes: rule.startDelayMinutes,
          ruleOrder: rule.ruleOrder,
          enabled: rule.enabled,
          createdAt: rule.createdAt,
        },
      });
    } catch (error) {
      logger.error('Error updating notification rule:', error);
      return res.status(500).json({ error: 'Failed to update notification rule' });
    }
  }
);

/**
 * DELETE /api/v1/users/me/notification-rules/:id
 * Delete a notification rule
 */
router.delete('/me/notification-rules/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;

    const dataSource = await getDataSource();
    const ruleRepo = dataSource.getRepository(UserNotificationRule);

    const rule = await ruleRepo.findOne({
      where: { id, userId: user.id },
    });

    if (!rule) {
      return res.status(404).json({ error: 'Notification rule not found' });
    }

    await ruleRepo.remove(rule);

    logger.info('Notification rule deleted', { userId: user.id, ruleId: id });

    return res.json({ message: 'Notification rule deleted successfully' });
  } catch (error) {
    logger.error('Error deleting notification rule:', error);
    return res.status(500).json({ error: 'Failed to delete notification rule' });
  }
});

// ============================================================================
// PROFILE PICTURE
// ============================================================================

/**
 * POST /api/v1/users/me/profile-picture/upload-url
 * Get a presigned URL for uploading a profile picture
 */
router.post('/me/profile-picture/upload-url', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { contentType = 'image/jpeg' } = req.body;

    // Validate content type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(contentType)) {
      return res.status(400).json({ error: 'Invalid content type. Allowed: jpeg, png, gif, webp' });
    }

    // Generate unique key for the image
    const extension = contentType.split('/')[1];
    const key = `profile-pictures/${user.orgId}/${user.id}/${Date.now()}.${extension}`;

    // Create presigned URL for PUT
    const command = new PutObjectCommand({
      Bucket: UPLOADS_BUCKET,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 }); // 5 minutes

    // Construct the public URL
    const publicUrl = `https://${UPLOADS_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;

    logger.info('Generated profile picture upload URL', { userId: user.id, key });

    return res.json({
      uploadUrl,
      publicUrl,
      key,
      expiresIn: 300,
    });
  } catch (error) {
    logger.error('Error generating upload URL:', error);
    return res.status(500).json({ error: 'Failed to generate upload URL' });
  }
});

/**
 * PUT /api/v1/users/me/profile-picture
 * Update user's profile picture URL after successful upload
 */
router.put(
  '/me/profile-picture',
  [
    body('profilePictureUrl').isString().isURL().withMessage('Valid URL is required'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const user = req.user!;
      const { profilePictureUrl } = req.body;

      // Validate the URL is from allowed sources (our S3 bucket or DiceBear for default avatars)
      const isS3Url = profilePictureUrl.includes(UPLOADS_BUCKET);
      const isDiceBearUrl = profilePictureUrl.startsWith('https://api.dicebear.com/');
      if (!isS3Url && !isDiceBearUrl) {
        return res.status(400).json({ error: 'Invalid profile picture URL' });
      }

      const dataSource = await getDataSource();
      const userRepo = dataSource.getRepository(User);

      // Delete old profile picture from S3 if exists
      if (user.profilePictureUrl && user.profilePictureUrl.includes(UPLOADS_BUCKET)) {
        try {
          const oldKey = user.profilePictureUrl.split('.amazonaws.com/')[1];
          if (oldKey) {
            await s3Client.send(new DeleteObjectCommand({
              Bucket: UPLOADS_BUCKET,
              Key: oldKey,
            }));
            logger.info('Deleted old profile picture', { userId: user.id, key: oldKey });
          }
        } catch (deleteError) {
          logger.warn('Failed to delete old profile picture:', deleteError);
        }
      }

      await userRepo.update(user.id, { profilePictureUrl });

      logger.info('Profile picture updated', { userId: user.id, url: profilePictureUrl });

      return res.json({
        message: 'Profile picture updated successfully',
        profilePictureUrl,
      });
    } catch (error) {
      logger.error('Error updating profile picture:', error);
      return res.status(500).json({ error: 'Failed to update profile picture' });
    }
  }
);

/**
 * DELETE /api/v1/users/me/profile-picture
 * Remove user's profile picture
 */
router.delete('/me/profile-picture', async (req: Request, res: Response) => {
  try {
    const user = req.user!;

    // Delete from S3 if exists
    if (user.profilePictureUrl && user.profilePictureUrl.includes(UPLOADS_BUCKET)) {
      try {
        const key = user.profilePictureUrl.split('.amazonaws.com/')[1];
        if (key) {
          await s3Client.send(new DeleteObjectCommand({
            Bucket: UPLOADS_BUCKET,
            Key: key,
          }));
          logger.info('Deleted profile picture from S3', { userId: user.id, key });
        }
      } catch (deleteError) {
        logger.warn('Failed to delete profile picture from S3:', deleteError);
      }
    }

    const dataSource = await getDataSource();
    const userRepo = dataSource.getRepository(User);

    await userRepo.update(user.id, { profilePictureUrl: null });

    logger.info('Profile picture removed', { userId: user.id });

    return res.json({ message: 'Profile picture removed successfully' });
  } catch (error) {
    logger.error('Error removing profile picture:', error);
    return res.status(500).json({ error: 'Failed to remove profile picture' });
  }
});

export default router;
