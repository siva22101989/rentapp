
'use server';

import { z } from 'zod';
import axios from 'axios';

const SendSmsSchema = z.object({
  apiKey: z.string().min(1, { message: 'API Key is required.'}),
  to: z.string().min(10, { message: 'A valid 10-digit phone number is required.'}),
  message: z.string().min(1, { message: 'Message cannot be empty.'}),
});

export async function sendSms(formData: { apiKey: string; to: string; message: string; senderId?: string }) {
  const validatedFields = SendSmsSchema.safeParse(formData);

  if (!validatedFields.success) {
    console.error('SMS validation failed:', validatedFields.error.flatten().fieldErrors);
    // Don't return an error to the user, just log it. SMS is non-critical.
    return;
  }

  const { apiKey, to, message } = validatedFields.data;
  const senderId = formData.senderId || 'TXTBEE'; // Use the default TXTBEE sender ID for better reliability

  // Clean the phone number to ensure it's just digits
  const cleanedPhoneNumber = to.replace(/\D/g, '');
  
  if (cleanedPhoneNumber.length < 10) {
      console.error(`SMS validation failed: Phone number "${to}" is too short after cleaning.`);
      return;
  }
  // Take the last 10 digits to be safe, which is standard for Indian mobile numbers
  const tenDigitPhoneNumber = cleanedPhoneNumber.slice(-10);

  try {
    const response = await axios.post('https://api.textbee.dev/api/send', {
      api_key: apiKey,
      sender: senderId,
      to: `+91${tenDigitPhoneNumber}`, // Use the cleaned 10-digit number
      message,
    });

    if (response.status === 200 && response.data.status === 'success') {
      console.log('SMS sent successfully:', response.data);
    } else {
      console.error('Failed to send SMS (API Error):', response.data);
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
        console.error('Error sending SMS via Axios:', {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message,
        });
    } else {
        console.error('Unknown error sending SMS:', error);
    }
  }
}
