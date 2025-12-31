import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateUser, requireAdmin } from '../../shared/auth/middleware';
import { getDataSource } from '../../shared/db/data-source';
import { Team, TeamMembership, User, Schedule, EscalationPolicy, Service } from '../../shared/models';
import { logger } from '../../shared/utils/logger';

const router = Router();

// All routes require authentication
router.use(authenticateUser);

/**
 * GET /api/v1/teams
 * List all teams in the organization
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
 * GET /api/v1/teams/:id
 * Get a specific team with members and resources
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
 * POST /api/v1/teams
 * Create a new team (admin only)
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
 * PUT /api/v1/teams/:id
 * Update a team (admin only)
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
 * DELETE /api/v1/teams/:id
 * Delete a team (admin only)
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
 * GET /api/v1/teams/:id/members
 * List team members
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
 * POST /api/v1/teams/:id/members
 * Add a member to a team (admin only)
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
 * PUT /api/v1/teams/:id/members/:userId
 * Update a member's role (admin only)
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
 * DELETE /api/v1/teams/:id/members/:userId
 * Remove a member from a team (admin only)
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
