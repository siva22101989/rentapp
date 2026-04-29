
'use server';

import { z } from 'zod';

const SendSmsSchema = z.object({
  apiKey: z.string().min(1, { message: 'API Key is required.' }),
  to: z.string().min(10, { message: 'A valid 10-digit phone number is required.' }),
  message: z.string().min(1, { message: 'Message cannot be empty.' }),
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

  let url: string;
  let postData: string;

  if (deviceId) {
    url = `https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/send-sms`;
    postData = JSON.stringify({
      recipients: [`+91${tenDigitPhoneNumber}`],
      message: message
    });
  } else {
    url = 'https://api.textbee.dev/api/v1/bulksms/send';
    postData = JSON.stringify({
      messages: [
        {
          message: message,
          recipients: [tenDigitPhoneNumber]
        }
      ],
      sender_id: senderId || 'TXTBEE',
    });
  }
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: postData,
    });

    const responseData = await response.json();

    if (response.ok) {
        if (responseData.status === 'SUCCESS' || responseData.status === 'success' || !responseData.error) {
            console.log('SMS sent successfully:', responseData);
            return { success: true, message: responseData.message || "SMS sent successfully!" };
        } else {
            const apiMessage = responseData.error?.message || responseData.error || responseData.message || `Unknown API error`;
            console.error('Failed to send SMS (API Error):', responseData);
            return { success: false, message: `Failed to send SMS: ${apiMessage}` };
        }
    } else {
        const apiMessage = responseData.error?.message || responseData.error || responseData.message || `Unknown API error (Status: ${response.status})`;
        console.error('Failed to send SMS (HTTP Error):', responseData);
        return { success: false, message: `Failed to send SMS: ${apiMessage}` };
    }
  } catch (e) {
      console.error('Error in sendSms fetch request:', e);
      if (e instanceof Error) {
        return { success: false, message: `Network error: ${e.message}` };
      }
      return { success: false, message: 'An unknown network error occurred.' };
  }
}
