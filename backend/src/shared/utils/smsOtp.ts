import twilio from 'twilio';
import { env } from '../../config/environment';
import { logger } from './logger';

let twilioClient: ReturnType<typeof twilio> | null = null;

function getClient() {
  if (!twilioClient) {
    if (!env.twilioAccountSid || !env.twilioAuthToken || env.twilioAccountSid.startsWith('ACx')) {
      return null; // not configured
    }
    twilioClient = twilio(env.twilioAccountSid, env.twilioAuthToken);
  }
  return twilioClient;
}

export async function sendOtpSms(phone: string, code: string): Promise<void> {
  const client = getClient();

  if (!client || process.env.NODE_ENV !== 'production') {
    // Dev mode: just log the OTP
    logger.info({ phone, code }, '📱 [DEV] SMS OTP — code logged, not sent via Twilio');
    return;
  }

  await client.messages.create({
    body: `Your Roomie verification code: ${code}. Valid for 5 minutes.`,
    from: env.twilioFromNumber,
    to: phone,
  });

  logger.info({ phone }, 'SMS OTP sent via Twilio');
}
