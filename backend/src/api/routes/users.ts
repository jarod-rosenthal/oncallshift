import { Router, Request, Response } from 'express';
import { authenticateUser } from '../../shared/auth/middleware';
import { logger } from '../../shared/utils/logger';

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
        settings: user.settings,
        organization: {
          id: user.organization.id,
          name: user.organization.name,
        },
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    logger.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

export default router;
