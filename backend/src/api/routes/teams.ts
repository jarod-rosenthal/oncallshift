import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateRequest, requireAdmin } from '../../shared/auth/middleware';
import { getDataSource } from '../../shared/db/data-source';
import { Team, TeamMembership, User, Schedule, EscalationPolicy, Service } from '../../shared/models';
import { logger } from '../../shared/utils/logger';
import { generateEntityETag } from '../../shared/utils/etag';
import { checkETagAndRespond } from '../../shared/middleware/etag';
import { setLocationHeader } from '../../shared/utils/location-header';

const router = Router();

// All routes require authentication (supports JWT, service API key, and org API key)
router.use(authenticateRequest);

/**
 * @swagger
 * /api/v1/teams:
 *   get:
 *     summary: List all teams
 *     description: Retrieves all teams in the authenticated user's organization with their members.
 *     tags: [Teams]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: List of teams retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 teams:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/Team'
 *                       - type: object
 *                         properties:
 *                           memberCount:
 *                             type: integer
 *                             description: Number of members in the team
 *                           members:
 *                             type: array
 *                             items:
 *                               $ref: '#/components/schemas/TeamMember'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const teamRepo = dataSource.getRepository(Team);

    const teams = await teamRepo.find({
      where: { orgId },
      relations: ['memberships', 'memberships.user'],
      order: { name: 'ASC' },
    });

    return res.json({
      teams: teams.map(team => ({
        id: team.id,
        name: team.name,
        description: team.description,
        slug: team.slug,
        memberCount: team.memberships?.length || 0,
        members: team.memberships?.map(m => ({
          id: m.id,
          userId: m.userId,
          role: m.role,
          user: m.user ? {
            id: m.user.id,
            fullName: m.user.fullName,
            email: m.user.email,
          } : null,
        })) || [],
        createdAt: team.createdAt,
        updatedAt: team.updatedAt,
      })),
    });
  } catch (error) {
    logger.error('Error listing teams:', error);
    return res.status(500).json({ error: 'Failed to list teams' });
  }
});

/**
 * @swagger
 * /api/v1/teams/{id}:
 *   get:
 *     summary: Get a team by ID
 *     description: Retrieves a specific team with its members and associated resources (schedules, escalation policies, services).
 *     tags: [Teams]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Team ID
 *     responses:
 *       200:
 *         description: Team retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 team:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Team'
 *                     - type: object
 *                       properties:
 *                         memberCount:
 *                           type: integer
 *                           description: Number of members in the team
 *                         members:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/TeamMember'
 *                         resources:
 *                           type: object
 *                           properties:
 *                             schedules:
 *                               type: array
 *                               items:
 *                                 type: object
 *                                 properties:
 *                                   id:
 *                                     type: string
 *                                     format: uuid
 *                                   name:
 *                                     type: string
 *                             escalationPolicies:
 *                               type: array
 *                               items:
 *                                 type: object
 *                                 properties:
 *                                   id:
 *                                     type: string
 *                                     format: uuid
 *                                   name:
 *                                     type: string
 *                             services:
 *                               type: array
 *                               items:
 *                                 type: object
 *                                 properties:
 *                                   id:
 *                                     type: string
 *                                     format: uuid
 *                                   name:
 *                                     type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Team not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const teamRepo = dataSource.getRepository(Team);
    const scheduleRepo = dataSource.getRepository(Schedule);
    const policyRepo = dataSource.getRepository(EscalationPolicy);
    const serviceRepo = dataSource.getRepository(Service);

    const team = await teamRepo.findOne({
      where: { id, orgId },
      relations: ['memberships', 'memberships.user'],
    });

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Generate ETag from team ID and updatedAt timestamp
    const etag = generateEntityETag(team.id, team.updatedAt);

    // Check If-None-Match - return 304 if client's cached version is current
    if (checkETagAndRespond(req, res, etag)) {
      return; // 304 was sent
    }

    // Get resources assigned to this team
    const [schedules, policies, services] = await Promise.all([
      scheduleRepo.find({ where: { teamId: id, orgId } }),
      policyRepo.find({ where: { teamId: id, orgId } }),
      serviceRepo.find({ where: { teamId: id, orgId } }),
    ]);

    return res.json({
      team: {
        id: team.id,
        name: team.name,
        description: team.description,
        slug: team.slug,
        settings: team.settings,
        memberCount: team.memberships?.length || 0,
        members: team.memberships?.map(m => ({
          id: m.id,
          userId: m.userId,
          role: m.role,
          user: m.user ? {
            id: m.user.id,
            fullName: m.user.fullName,
            email: m.user.email,
          } : null,
          createdAt: m.createdAt,
        })) || [],
        resources: {
          schedules: schedules.map(s => ({ id: s.id, name: s.name })),
          escalationPolicies: policies.map(p => ({ id: p.id, name: p.name })),
          services: services.map(s => ({ id: s.id, name: s.name })),
        },
        createdAt: team.createdAt,
        updatedAt: team.updatedAt,
      },
    });
  } catch (error) {
    logger.error('Error fetching team:', error);
    return res.status(500).json({ error: 'Failed to fetch team' });
  }
});

/**
 * @swagger
 * /api/v1/teams:
 *   post:
 *     summary: Create a new team
 *     description: Creates a new team in the organization. Requires admin privileges.
 *     tags: [Teams]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TeamCreate'
 *     responses:
 *       201:
 *         description: Team created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Team created successfully
 *                 team:
 *                   $ref: '#/components/schemas/Team'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       409:
 *         description: Team with this name or slug already exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: A team with this name or slug already exists
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/',
  requireAdmin,
  [
    body('name').isString().trim().notEmpty().isLength({ max: 255 }).withMessage('Name is required (max 255 chars)'),
    body('description').optional({ nullable: true }).isString().withMessage('Description must be a string'),
    body('slug').optional({ nullable: true }).isString().isLength({ max: 100 }).withMessage('Slug max 100 chars'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const orgId = req.orgId!;
      const { name, description, slug } = req.body;

      const dataSource = await getDataSource();
      const teamRepo = dataSource.getRepository(Team);

      // Generate slug if not provided
      const teamSlug = slug || Team.generateSlug(name);

      // Check for duplicate name or slug
      const existing = await teamRepo.findOne({
        where: [
          { orgId, name },
          { orgId, slug: teamSlug },
        ],
      });

      if (existing) {
        return res.status(409).json({ error: 'A team with this name or slug already exists' });
      }

      const team = teamRepo.create({
        orgId,
        name,
        description: description || null,
        slug: teamSlug,
        settings: {},
      });

      await teamRepo.save(team);

      logger.info('Team created', { teamId: team.id, orgId, name });

      setLocationHeader(res, req, '/api/v1/teams', team.id);
      return res.status(201).json({
        message: 'Team created successfully',
        team: {
          id: team.id,
          name: team.name,
          description: team.description,
          slug: team.slug,
          memberCount: 0,
          createdAt: team.createdAt,
        },
      });
    } catch (error) {
      logger.error('Error creating team:', error);
      return res.status(500).json({ error: 'Failed to create team' });
    }
  }
);

/**
 * @swagger
 * /api/v1/teams/{id}:
 *   put:
 *     summary: Update a team
 *     description: Updates an existing team. Requires admin privileges.
 *     tags: [Teams]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Team ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TeamUpdate'
 *     responses:
 *       200:
 *         description: Team updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Team updated successfully
 *                 team:
 *                   $ref: '#/components/schemas/Team'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       404:
 *         description: Team not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       409:
 *         description: Team with this name or slug already exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: A team with this name already exists
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put(
  '/:id',
  requireAdmin,
  [
    body('name').optional().isString().trim().notEmpty().isLength({ max: 255 }),
    body('description').optional({ nullable: true }).isString(),
    body('slug').optional({ nullable: true }).isString().isLength({ max: 100 }),
    body('settings').optional().isObject(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const orgId = req.orgId!;
      const { name, description, slug, settings } = req.body;

      const dataSource = await getDataSource();
      const teamRepo = dataSource.getRepository(Team);

      const team = await teamRepo.findOne({ where: { id, orgId } });

      if (!team) {
        return res.status(404).json({ error: 'Team not found' });
      }

      // Check for duplicate name or slug if changing
      if (name && name !== team.name) {
        const existingName = await teamRepo.findOne({ where: { orgId, name } });
        if (existingName) {
          return res.status(409).json({ error: 'A team with this name already exists' });
        }
        team.name = name;
      }

      if (slug !== undefined && slug !== team.slug) {
        const existingSlug = await teamRepo.findOne({ where: { orgId, slug } });
        if (existingSlug) {
          return res.status(409).json({ error: 'A team with this slug already exists' });
        }
        team.slug = slug;
      }

      if (description !== undefined) {
        team.description = description || null;
      }

      if (settings !== undefined) {
        team.settings = { ...team.settings, ...settings };
      }

      await teamRepo.save(team);

      logger.info('Team updated', { teamId: id, orgId });

      return res.json({
        message: 'Team updated successfully',
        team: {
          id: team.id,
          name: team.name,
          description: team.description,
          slug: team.slug,
          settings: team.settings,
          updatedAt: team.updatedAt,
        },
      });
    } catch (error) {
      logger.error('Error updating team:', error);
      return res.status(500).json({ error: 'Failed to update team' });
    }
  }
);

/**
 * @swagger
 * /api/v1/teams/{id}:
 *   delete:
 *     summary: Delete a team
 *     description: Deletes a team from the organization. Requires admin privileges.
 *     tags: [Teams]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Team ID
 *     responses:
 *       200:
 *         description: Team deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Team deleted successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       404:
 *         description: Team not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const teamRepo = dataSource.getRepository(Team);

    const team = await teamRepo.findOne({ where: { id, orgId } });

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    await teamRepo.remove(team);

    logger.info('Team deleted', { teamId: id, orgId });

    return res.json({ message: 'Team deleted successfully' });
  } catch (error) {
    logger.error('Error deleting team:', error);
    return res.status(500).json({ error: 'Failed to delete team' });
  }
});

// ============ Team Membership Routes ============

/**
 * @swagger
 * /api/v1/teams/{id}/members:
 *   get:
 *     summary: List team members
 *     description: Retrieves all members of a specific team.
 *     tags: [Teams]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Team ID
 *     responses:
 *       200:
 *         description: Team members retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 teamId:
 *                   type: string
 *                   format: uuid
 *                 teamName:
 *                   type: string
 *                 members:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TeamMember'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Team not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id/members', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const teamRepo = dataSource.getRepository(Team);
    const membershipRepo = dataSource.getRepository(TeamMembership);

    const team = await teamRepo.findOne({ where: { id, orgId } });
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const memberships = await membershipRepo.find({
      where: { teamId: id },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });

    return res.json({
      teamId: id,
      teamName: team.name,
      members: memberships.map(m => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        user: m.user ? {
          id: m.user.id,
          fullName: m.user.fullName,
          email: m.user.email,
        } : null,
        createdAt: m.createdAt,
      })),
    });
  } catch (error) {
    logger.error('Error listing team members:', error);
    return res.status(500).json({ error: 'Failed to list team members' });
  }
});

/**
 * @swagger
 * /api/v1/teams/{id}/members:
 *   post:
 *     summary: Add a member to a team
 *     description: Adds a user as a member of the team. Requires admin privileges.
 *     tags: [Teams]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Team ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the user to add
 *               role:
 *                 type: string
 *                 enum: [manager, member]
 *                 default: member
 *                 description: Role of the member in the team
 *     responses:
 *       201:
 *         description: Member added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Member added successfully
 *                 member:
 *                   $ref: '#/components/schemas/TeamMember'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       404:
 *         description: Team or user not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       409:
 *         description: User is already a member of this team
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: User is already a member of this team
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/:id/members',
  requireAdmin,
  [
    body('userId').isUUID().withMessage('Valid user ID is required'),
    body('role').optional().isIn(['manager', 'member']).withMessage('Role must be manager or member'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const orgId = req.orgId!;
      const { userId, role = 'member' } = req.body;

      const dataSource = await getDataSource();
      const teamRepo = dataSource.getRepository(Team);
      const userRepo = dataSource.getRepository(User);
      const membershipRepo = dataSource.getRepository(TeamMembership);

      const team = await teamRepo.findOne({ where: { id, orgId } });
      if (!team) {
        return res.status(404).json({ error: 'Team not found' });
      }

      const user = await userRepo.findOne({ where: { id: userId, orgId } });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if already a member
      const existing = await membershipRepo.findOne({
        where: { teamId: id, userId },
      });
      if (existing) {
        return res.status(409).json({ error: 'User is already a member of this team' });
      }

      const membership = membershipRepo.create({
        teamId: id,
        userId,
        role,
      });

      await membershipRepo.save(membership);

      logger.info('Team member added', { teamId: id, userId, role, orgId });

      setLocationHeader(res, req, `/api/v1/teams/${id}/members`, membership.id);
      return res.status(201).json({
        message: 'Member added successfully',
        member: {
          id: membership.id,
          userId: membership.userId,
          role: membership.role,
          user: {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
          },
          createdAt: membership.createdAt,
        },
      });
    } catch (error) {
      logger.error('Error adding team member:', error);
      return res.status(500).json({ error: 'Failed to add team member' });
    }
  }
);

/**
 * @swagger
 * /api/v1/teams/{id}/members/{userId}:
 *   put:
 *     summary: Update a member's role
 *     description: Updates the role of a team member. Requires admin privileges.
 *     tags: [Teams]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Team ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID of the member
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [manager, member]
 *                 description: New role for the member
 *     responses:
 *       200:
 *         description: Member role updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Member role updated successfully
 *                 member:
 *                   $ref: '#/components/schemas/TeamMember'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       404:
 *         description: Team or member not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put(
  '/:id/members/:userId',
  requireAdmin,
  [
    body('role').isIn(['manager', 'member']).withMessage('Role must be manager or member'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id, userId } = req.params;
      const orgId = req.orgId!;
      const { role } = req.body;

      const dataSource = await getDataSource();
      const teamRepo = dataSource.getRepository(Team);
      const membershipRepo = dataSource.getRepository(TeamMembership);

      const team = await teamRepo.findOne({ where: { id, orgId } });
      if (!team) {
        return res.status(404).json({ error: 'Team not found' });
      }

      const membership = await membershipRepo.findOne({
        where: { teamId: id, userId },
        relations: ['user'],
      });
      if (!membership) {
        return res.status(404).json({ error: 'Member not found in this team' });
      }

      membership.role = role;
      await membershipRepo.save(membership);

      logger.info('Team member role updated', { teamId: id, userId, role, orgId });

      return res.json({
        message: 'Member role updated successfully',
        member: {
          id: membership.id,
          userId: membership.userId,
          role: membership.role,
          user: membership.user ? {
            id: membership.user.id,
            fullName: membership.user.fullName,
            email: membership.user.email,
          } : null,
        },
      });
    } catch (error) {
      logger.error('Error updating team member:', error);
      return res.status(500).json({ error: 'Failed to update team member' });
    }
  }
);

/**
 * @swagger
 * /api/v1/teams/{id}/members/{userId}:
 *   delete:
 *     summary: Remove a member from a team
 *     description: Removes a user from the team. Requires admin privileges.
 *     tags: [Teams]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Team ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID of the member to remove
 *     responses:
 *       200:
 *         description: Member removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Member removed successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       404:
 *         description: Team or member not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:id/members/:userId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id, userId } = req.params;
    const orgId = req.orgId!;

    const dataSource = await getDataSource();
    const teamRepo = dataSource.getRepository(Team);
    const membershipRepo = dataSource.getRepository(TeamMembership);

    const team = await teamRepo.findOne({ where: { id, orgId } });
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const membership = await membershipRepo.findOne({
      where: { teamId: id, userId },
    });
    if (!membership) {
      return res.status(404).json({ error: 'Member not found in this team' });
    }

    await membershipRepo.remove(membership);

    logger.info('Team member removed', { teamId: id, userId, orgId });

    return res.json({ message: 'Member removed successfully' });
  } catch (error) {
    logger.error('Error removing team member:', error);
    return res.status(500).json({ error: 'Failed to remove team member' });
  }
});

export default router;
