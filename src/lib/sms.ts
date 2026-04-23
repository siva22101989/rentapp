
'use server';

import { z } from 'zod';
import axios from 'axios';

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
    let response;
    if (deviceId) {
      response = await axios.post('https://api.textbee.dev/api/send-sms-otp-device', {
        api_key: apiKey,
        deviceId: deviceId,
        number: tenDigitPhoneNumber,
        message,
      });
    } else {
      const senderId = formData.senderId || 'TXTBEE';
      response = await axios.post('https://api.textbee.dev/api/send', {
        api_key: apiKey,
        sender: senderId,
        to: `+91${tenDigitPhoneNumber}`,
        message,
      });
    }

    if (response.status === 200 && response.data.status === 'success') {
      console.log('SMS sent successfully:', response.data);
      return { success: true, message: response.data.message || "SMS sent successfully!" };
    } else {
      const apiMessage = response.data.message || 'Unknown API error.';
      console.error('Failed to send SMS (API Error):', response.data);
      return { success: false, message: `Failed to send SMS: ${apiMessage}` };
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.message || error.message;
        console.error('Error sending SMS via Axios:', {
            status: error.response?.status,
            data: error.response?.data,
            message: errorMessage,
        });
        return { success: false, message: `Network error: ${errorMessage}` };
    } else {
        console.error('Unknown error sending SMS:', error);
        return { success: false, message: 'An unknown error occurred while sending the SMS.' };
    }
  }
}
