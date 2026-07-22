import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter && process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }
  return transporter!;
}

export async function sendEmailOtp(to: string, code: string): Promise<boolean> {
  const transport = getTransporter();
  if (!transport) {
    console.log(`[EMAIL] Gmail not configured. OTP for ${to}: ${code}`);
    return false;
  }

  try {
    await transport.sendMail({
      from: `"Moto Tracker" <${process.env.GMAIL_USER}>`,
      to,
      subject: 'Tu código de verificación - Moto Tracker',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333; text-align: center;">Código de Verificación</h2>
          <p style="color: #666; font-size: 16px;">Tu código de verificación es:</p>
          <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; text-align: center; margin: 16px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">${code}</span>
          </div>
          <p style="color: #999; font-size: 13px;">Este código expira en 5 minutos. Si no solicitaste este código, puedes ignorar este correo.</p>
        </div>
      `,
    });
    console.log(`[EMAIL] OTP sent to ${to}`);
    return true;
  } catch (error) {
    console.error('[EMAIL] Failed to send OTP:', error);
    console.log(`[EMAIL] Fallback — OTP for ${to}: ${code}`);
    return false;
  }
}
