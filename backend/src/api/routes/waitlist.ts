import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { getDataSource } from '../../shared/db/data-source';
import { WaitlistEntry } from '../../shared/models/WaitlistEntry';
import { logger } from '../../shared/utils/logger';

const router = Router();

const sesClient = new SESClient({ region: process.env.SES_REGION || 'us-east-2' });

/**
 * POST /api/v1/waitlist
 * Public endpoint — join the waitlist
 */
router.post(
  '/',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('fullName').optional().isString().trim().isLength({ max: 255 }),
    body('source').optional().isString().trim().isLength({ max: 50 }),
    body('plan').optional().isString().trim().isLength({ max: 50 }),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, fullName, source, plan } = req.body;

    try {
      const dataSource = await getDataSource();
      const repo = dataSource.getRepository(WaitlistEntry);

      // Check for duplicate — return success either way (prevent email enumeration)
      const existing = await repo.findOne({ where: { email } });
      if (existing) {
        return res.status(200).json({ message: "You're on the list! We'll be in touch soon." });
      }

      const entry = repo.create({
        email,
        fullName: fullName || null,
        source: source || null,
        plan: plan || null,
      });
      await repo.save(entry);

      // Send confirmation email (fire-and-forget)
      sendConfirmationEmail(email, fullName).catch((err) => {
        logger.error('Failed to send waitlist confirmation email', { email, error: err.message });
      });

      logger.info('New waitlist signup', { email, source, plan });

      return res.status(201).json({ message: "You're on the list! We'll be in touch soon." });
    } catch (err: any) {
      logger.error('Waitlist signup error', { error: err.message });
      return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  }
);

/**
 * GET /api/v1/waitlist/count
 * Public endpoint — returns total waitlist count for social proof
 */
router.get('/count', async (_req: Request, res: Response) => {
  try {
    const dataSource = await getDataSource();
    const repo = dataSource.getRepository(WaitlistEntry);
    const count = await repo.count();
    return res.status(200).json({ count });
  } catch (err: any) {
    logger.error('Waitlist count error', { error: err.message });
    return res.status(500).json({ error: 'Failed to get count' });
  }
});

/**
 * Fire-and-forget confirmation email via SES
 */
async function sendConfirmationEmail(email: string, fullName?: string | null): Promise<void> {
  const name = fullName || 'there';
  const command = new SendEmailCommand({
    Source: process.env.SES_FROM_EMAIL || 'hello@oncallshift.com',
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: "You're on the OnCallShift waitlist!" },
      Body: {
        Html: {
          Data: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
              <h1 style="color: #0f172a; font-size: 24px; margin-bottom: 16px;">Hey ${name}!</h1>
              <p style="color: #475569; font-size: 16px; line-height: 1.6;">
                Thanks for signing up for the OnCallShift waitlist. We're building the AI-native incident platform
                that DevOps teams actually want to use.
              </p>
              <p style="color: #475569; font-size: 16px; line-height: 1.6;">
                We'll let you know as soon as early access is available. In the meantime, check out our
                <a href="https://oncallshift.com/docs" style="color: #14b8a6; text-decoration: none;">docs</a>
                and <a href="https://oncallshift.com/blog" style="color: #14b8a6; text-decoration: none;">blog</a>.
              </p>
              <p style="color: #94a3b8; font-size: 14px; margin-top: 32px;">
                — The OnCallShift Team
              </p>
            </div>
          `,
        },
        Text: {
          Data: `Hey ${name}!\n\nThanks for signing up for the OnCallShift waitlist. We'll let you know as soon as early access is available.\n\n— The OnCallShift Team`,
        },
      },
    },
  });

  await sesClient.send(command);
}

export default router;
