import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { CognitoIdentityProviderClient, SignUpCommand, AdminConfirmSignUpCommand, InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider';
import { getDataSource } from '../../shared/db/data-source';
import { User, Organization } from '../../shared/models';
import { logger } from '../../shared/utils/logger';
import { authRateLimiter } from '../../shared/middleware/rate-limiter';

const router = Router();

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

/**
 * @openapi
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new user and organization
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - fullName
 *               - organizationName
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               fullName:
 *                 type: string
 *               organizationName:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Registration successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 organization:
 *                   type: object
 *       400:
 *         description: Validation error or user already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/register',
  authRateLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('fullName').isString().notEmpty().withMessage('Full name is required'),
    body('organizationName').isString().notEmpty().withMessage('Organization name is required'),
    body('phoneNumber').optional({ values: 'falsy' }).isMobilePhone('any'),
  ],
  async (req: Request, res: Response) => {
    logger.info('Registration attempt started', { email: req.body.email });
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.info('Registration validation failed', { errors: errors.array() });
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, fullName, organizationName, phoneNumber } = req.body;
      logger.info('Registration validation passed', { email, fullName, organizationName });

      // Registration domain whitelist - only allow specific domains
      const allowedDomains = ['oncallshift.com'];
      const emailDomain = email.split('@')[1]?.toLowerCase();

      if (!emailDomain || !allowedDomains.includes(emailDomain)) {
        logger.info('Registration blocked - domain not whitelisted', { email, emailDomain });
        return res.status(403).json({
          error: 'Registration is currently restricted. Please contact an administrator.',
        });
      }

      const dataSource = await getDataSource();
      const orgRepo = dataSource.getRepository(Organization);
      const userRepo = dataSource.getRepository(User);

      // Check if user already exists
      const existingUser = await userRepo.findOne({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ error: 'User with this email already exists' });
      }

      // Create user in Cognito
      logger.info('Creating user in Cognito', { email, clientId: process.env.COGNITO_CLIENT_ID });
      const signUpCommand = new SignUpCommand({
        ClientId: process.env.COGNITO_CLIENT_ID!,
        Username: email,
        Password: password,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'name', Value: fullName },
        ],
      });

      const signUpResult = await cognitoClient.send(signUpCommand);
      const cognitoSub = signUpResult.UserSub!;

      logger.info('User created in Cognito', { email, cognitoSub });

      // Auto-confirm user for MVP (in production, use email verification)
      const confirmCommand = new AdminConfirmSignUpCommand({
        UserPoolId: process.env.COGNITO_USER_POOL_ID!,
        Username: email,
      });
      await cognitoClient.send(confirmCommand);

      logger.info('User auto-confirmed in Cognito', { email });

      try {
        // Create organization
        const organization = orgRepo.create({
          name: organizationName,
          status: 'active',
          plan: 'free',
        });
        await orgRepo.save(organization);

        logger.info('Organization created', { orgId: organization.id, name: organizationName });

        // Create user in database
        const user = userRepo.create({
          email,
          cognitoSub,
          fullName,
          orgId: organization.id,
          role: 'admin', // First user in org is admin
          status: 'active',
          phoneNumber: phoneNumber || null,
        });
        await userRepo.save(user);

        logger.info('User created in database', { userId: user.id, email });

        return res.status(201).json({
          message: 'Registration successful',
          user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
          },
          organization: {
            id: organization.id,
            name: organization.name,
          },
        });
      } catch (dbError) {
        // Rollback: Delete Cognito user if database operations fail
        logger.error('Database error during registration, cleaning up Cognito user', dbError);
        // Note: AdminDeleteUser would be called here in production
        throw dbError;
      }
    } catch (error: any) {
      logger.error('Registration error:', error);

      if (error.name === 'UsernameExistsException') {
        return res.status(400).json({ error: 'User with this email already exists in Cognito' });
      }

      if (error.name === 'InvalidPasswordException') {
        return res.status(400).json({ error: 'Password does not meet requirements' });
      }

      return res.status(500).json({ error: 'Registration failed', details: error.message });
    }
  }
);

/**
 * @openapi
 * /api/v1/auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 tokens:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                     idToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *                     expiresIn:
 *                       type: integer
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/login',
  authRateLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      // Authenticate with Cognito
      const authCommand = new InitiateAuthCommand({
        ClientId: process.env.COGNITO_CLIENT_ID!,
        AuthFlow: 'USER_PASSWORD_AUTH',
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      });

      const authResult = await cognitoClient.send(authCommand);

      if (!authResult.AuthenticationResult) {
        return res.status(401).json({ error: 'Authentication failed' });
      }

      const { AccessToken, IdToken, RefreshToken, ExpiresIn } = authResult.AuthenticationResult;

      logger.info('User logged in', { email });

      return res.json({
        message: 'Login successful',
        tokens: {
          accessToken: AccessToken,
          idToken: IdToken,
          refreshToken: RefreshToken,
          expiresIn: ExpiresIn,
        },
      });
    } catch (error: any) {
      logger.error('Login error:', error);

      if (error.name === 'NotAuthorizedException') {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      if (error.name === 'UserNotFoundException') {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      return res.status(500).json({ error: 'Login failed', details: error.message });
    }
  }
);

/**
 * POST /api/v1/auth/refresh
 * Refresh access token using refresh token
 */
router.post(
  '/refresh',
  authRateLimiter,
  [
    body('refreshToken').notEmpty().withMessage('Refresh token is required'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { refreshToken } = req.body;

      const authCommand = new InitiateAuthCommand({
        ClientId: process.env.COGNITO_CLIENT_ID!,
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
        },
      });

      const authResult = await cognitoClient.send(authCommand);

      if (!authResult.AuthenticationResult) {
        return res.status(401).json({ error: 'Token refresh failed' });
      }

      const { AccessToken, IdToken, ExpiresIn } = authResult.AuthenticationResult;

      return res.json({
        message: 'Token refreshed successfully',
        tokens: {
          accessToken: AccessToken,
          idToken: IdToken,
          expiresIn: ExpiresIn,
        },
      });
    } catch (error: any) {
      logger.error('Token refresh error:', error);

      if (error.name === 'NotAuthorizedException') {
        return res.status(401).json({ error: 'Invalid refresh token' });
      }

      return res.status(500).json({ error: 'Token refresh failed', details: error.message });
    }
  }
);

export default router;
