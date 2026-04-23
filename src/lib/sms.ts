
'use server';

import { z } from 'zod';
import * as https from 'https';

const SendSmsSchema = z.object({
  apiKey: z.string().min(1, { message: 'API Key is required.'}),
  to: z.string().min(10, { message: 'A valid 10-digit phone number is required.'}),
  message: z.string().min(1, { message: 'Message cannot be empty.'}),
  deviceId: z.string().optional(),
});

export async function sendSms(formData: { apiKey: string; to: string; message: string; senderId?: string; deviceId?: string }): Promise<{ success: boolean; message: string }> {
  const validatedFields = SendSmsSchema.safeParse(formData);

  if (!validatedFields.success) {
    const errorMessages = validatedFields.error.flatten().fieldErrors;
    const firstError = Object.values(errorMessages)[0]?.[0] || 'Invalid input.';
    console.error('SMS validation failed:', errorMessages);
    return { success: false, message: `Validation failed: ${firstError}` };
  }

  const { apiKey, to, message, deviceId } = validatedFields.data;
  const cleanedPhoneNumber = to.replace(/\D/g, '');
  
  if (cleanedPhoneNumber.length < 10) {
      const errorMsg = `SMS validation failed: Phone number "${to}" is too short.`;
      console.error(errorMsg);
      return { success: false, message: errorMsg };
  }
  const tenDigitPhoneNumber = cleanedPhoneNumber.slice(-10);

  return new Promise((resolve) => {
    let path: string;
    let postData: string;

    if (deviceId) {
      path = '/api/send-sms-otp-device';
      postData = JSON.stringify({
        api_key: apiKey,
        deviceId: deviceId,
        number: tenDigitPhoneNumber,
        message,
      });
    } else {
      path = '/api/send';
      postData = JSON.stringify({
        api_key: apiKey,
        sender: formData.senderId || 'TXTBEE',
        to: `+91${tenDigitPhoneNumber}`,
        message,
      });
    }

    const options = {
      hostname: 'api.textbee.dev',
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      res.on('end', () => {
        try {
          const responseData = JSON.parse(responseBody);
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300 && responseData.status === 'success') {
            console.log('SMS sent successfully:', responseData);
            resolve({ success: true, message: responseData.message || "SMS sent successfully!" });
          } else {
            const apiMessage = responseData.message || 'Unknown API error.';
            console.error('Failed to send SMS (API Error):', responseData);
            resolve({ success: false, message: `Failed to send SMS: ${apiMessage}` });
          }
        } catch (e) {
          console.error('Error parsing textbee.dev response:', e);
          resolve({ success: false, message: 'Failed to parse response from SMS service.' });
        }
      });
    });

    req.on('error', (e) => {
      console.error(`Problem with request: ${e.message}`);
      resolve({ success: false, message: `Network error: ${e.message}` });
    });

    // Write data to request body
    req.write(postData);
    req.end();
  });
}
