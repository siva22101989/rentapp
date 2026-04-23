
'use server';

import { z } from 'zod';

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

  try {
    let url: string;
    let body: object;
    
    if (deviceId) {
      url = 'https://api.textbee.dev/api/send-sms-otp-device';
      body = {
        api_key: apiKey,
        deviceId: deviceId,
        number: tenDigitPhoneNumber,
        message,
      };
    } else {
      url = 'https://api.textbee.dev/api/send';
      body = {
        api_key: apiKey,
        sender: formData.senderId || 'TXTBEE',
        to: `+91${tenDigitPhoneNumber}`,
        message,
      };
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    const responseData = await response.json();

    if (response.ok && responseData.status === 'success') {
      console.log('SMS sent successfully:', responseData);
      return { success: true, message: responseData.message || "SMS sent successfully!" };
    } else {
      const apiMessage = responseData.message || 'Unknown API error.';
      console.error('Failed to send SMS (API Error):', responseData);
      return { success: false, message: `Failed to send SMS: ${apiMessage}` };
    }
  } catch (error) {
    console.error('Unknown error sending SMS:', error);
    if (error instanceof Error) {
        return { success: false, message: `An unknown error occurred while sending the SMS: ${error.message}` };
    }
    return { success: false, message: 'An unknown error occurred while sending the SMS.' };
  }
}
