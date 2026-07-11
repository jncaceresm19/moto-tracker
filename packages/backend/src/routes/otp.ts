import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { sendOtp, verifyOtp } from '../services/otp';
import { createErrorResponse } from '@moto-tracker/shared';

const router = Router();

const sendOtpSchema = z.object({
  email: z.string().email('Invalid email format'),
  tipo: z.enum(['email', 'phone']).optional().default('email'),
  phone: z.string().optional(),
});

const verifyOtpSchema = z.object({
  code: z.string().length(6, 'Code must be 6 digits'),
});

// Simple sender (placeholder — replace with real SMTP/SMS in production)
async function sendNotification(to: string, subject: string, body: string, tipo: 'email' | 'phone'): Promise<void> {
  if (tipo === 'phone') {
    console.log(`[OTP] SMS to ${to}: ${body}`);
    // TODO: integrate with Twilio, Vonage, etc.
  } else {
    console.log(`[OTP] Email to ${to}: ${subject} — ${body}`);
    // TODO: integrate with SMTP service (nodemailer, SendGrid, etc.)
  }
}

router.post('/send', authenticate, validateBody(sendOtpSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { email, tipo, phone } = req.body;

    // Use phone for SMS, email for email
    const destination = tipo === 'phone' && phone ? phone : email;
    const result = await sendOtp(userId, destination, (to, subject, body) => sendNotification(to, subject, body, tipo), tipo);

    if (!result.success) {
      const status = result.error === 'ACCOUNT_LOCKED' ? 429 : 400;
      res.status(status).json(createErrorResponse(result.error!, 'OTP send failed'));
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[OTP] Send error:', error);
    res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'Failed to send OTP'));
  }
});

router.post('/verify', authenticate, validateBody(verifyOtpSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { code } = req.body;

    const result = await verifyOtp(userId, code);

    if (!result.success) {
      const status = result.error === 'ACCOUNT_LOCKED' ? 429 : 400;
      res.status(status).json(createErrorResponse(result.error!, 'OTP verification failed'));
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[OTP] Verify error:', error);
    res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'Failed to verify OTP'));
  }
});

export default router;
