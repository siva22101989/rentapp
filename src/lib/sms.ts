
'use server';

import { z } from 'zod';

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
  const senderId = formData.senderId || 'GRNDST'; // Default sender ID

  try {
    const response = await fetch('https://api.textbee.dev/api/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        sender: senderId,
        to: `+91${to}`, // Assuming Indian numbers
        message,
      }),
    });

    if (!response.ok) {
        const errorResult = await response.json();
        console.error('Failed to send SMS:', { status: response.status, error: errorResult });
        return;
    }

    const result = await response.json();
    if (result.status === 'success') {
      console.log('SMS sent successfully:', result);
    } else {
      console.error('Failed to send SMS (API Error):', result);
    }
  } catch (error) {
    console.error('Error sending SMS:', error);
  }
}
