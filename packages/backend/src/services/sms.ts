import twilio from 'twilio';

const client = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

export async function sendSmsOtp(to: string, code: string): Promise<boolean> {
  if (!client) {
    console.log(`[SMS] Twilio not configured. Code for ${to}: ${code}`);
    return false;
  }

  try {
    await client.messages.create({
      body: `Tu código de verificación Moto Tracker es: ${code}. Expira en 5 minutos.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
    });
    console.log(`[SMS] OTP sent to ${to}`);
    return true;
  } catch (error) {
    console.error('[SMS] Failed to send OTP:', error);
    return false;
  }
}
