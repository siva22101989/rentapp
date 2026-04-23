
'use server';

import { z } from 'zod';
import * as https from 'https';

const SendSmsSchema = z.object({
  apiKey: z.string().min(1, { message: 'API Key is required.'}),
  to: z.string().min(10, { message: 'A valid 10-digit phone number is required.'}),
  message: z.string().min(1, { message: 'Message cannot be empty.'}),
  deviceId: z.string().optional(),
  senderId: z.string().optional(),
});

export async function sendSms(formData: { apiKey: string; to: string; message: string; senderId?: string; deviceId?: string }): Promise<{ success: boolean; message: string }> {
  const validatedFields = SendSmsSchema.safeParse(formData);

  if (!validatedFields.success) {
    const errorMessages = validatedFields.error.flatten().fieldErrors;
    const firstError = Object.values(errorMessages)[0]?.[0] || 'Invalid input.';
    console.error('SMS validation failed:', errorMessages);
    return { success: false, message: `Validation failed: ${firstError}` };
  }

  const { apiKey, to, message, deviceId, senderId } = validatedFields.data;
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
    
    // Logic based on user's new snippet and modern API design
    if (deviceId) {
      path = `/api/v1/gateway/devices/${deviceId}/send-sms`;
      postData = JSON.stringify({
        recipients: [`+91${tenDigitPhoneNumber}`],
        message: message
      });
    } else {
      // This is an educated guess for their bulk API based on the v1 structure
      path = '/api/v1/bulksms/send';
      postData = JSON.stringify({
        messages: [
            {
                message: message,
                recipients: [`+91${tenDigitPhoneNumber}`]
            }
        ],
        sender: senderId || 'TXTBEE',
      });
    }
    
    const options = {
      hostname: 'api.textbee.dev',
      port: 443,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
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
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            if (responseData.status === 'SUCCESS' || responseData.status === 'success' || !responseData.error) {
                console.log('SMS sent successfully:', responseData);
                resolve({ success: true, message: responseData.message || "SMS sent successfully!" });
            } else {
                 const apiMessage = responseData.error || responseData.message || `Unknown API error`;
                 console.error('Failed to send SMS (API Error):', responseData);
                 resolve({ success: false, message: `Failed to send SMS: ${apiMessage}` });
            }
          } else {
            const apiMessage = responseData.error || responseData.message || `Unknown API error (Status: ${res.statusCode})`;
            console.error('Failed to send SMS (HTTP Error):', responseData);
            resolve({ success: false, message: `Failed to send SMS: ${apiMessage}` });
          }
        } catch (e) {
          console.error('Error parsing textbee.dev response:', e, 'Body:', responseBody);
          resolve({ success: false, message: 'Failed to parse response from SMS service.' });
        }
      });
    });

    req.on('error', (e) => {
      console.error(`Problem with request: ${e.message}`);
      resolve({ success: false, message: `Network error: ${e.message}` });
    });

    req.write(postData);
    req.end();
  });
}
