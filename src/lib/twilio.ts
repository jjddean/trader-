
import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

if (!accountSid || !authToken) {
  console.warn('Twilio credentials are not set in environment variables.');
}

const client = twilio(accountSid, authToken);

/**
 * Sends an SMS message using Twilio.
 * @param to The phone number to send the SMS to.
 * @param body The message content.
 * @param from The Twilio phone number to send from (optional, defaults to TWILIO_PHONE_NUMBER env).
 */
export async function sendSMS(to: string, body: string, from?: string) {
  const fromNumber = from || process.env.TWILIO_PHONE_NUMBER;
  if (!fromNumber) {
    throw new Error('Twilio sender phone number is not set.');
  }

  try {
    const message = await client.messages.create({
      body: body,
      from: fromNumber,
      to: to,
    });
    return message;
  } catch (error) {
    console.error('Error sending SMS via Twilio:', error);
    throw error;
  }
}

/**
 * Makes a voice call using Twilio.
 * @param to The phone number to call.
 * @param url The TwiML URL for the call.
 * @param from The Twilio phone number to call from (optional, defaults to TWILIO_PHONE_NUMBER env).
 */
export async function makeCall(to: string, url: string, from?: string) {
  const fromNumber = from || process.env.TWILIO_PHONE_NUMBER;
  if (!fromNumber) {
    throw new Error('Twilio sender phone number is not set.');
  }

  try {
    const call = await client.calls.create({
      url: url,
      from: fromNumber,
      to: to,
    });
    return call;
  } catch (error) {
    console.error('Error making call via Twilio:', error);
    throw error;
  }
}

export default client;
