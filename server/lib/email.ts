import { Resend } from "resend";

if (!process.env.RESEND_API_KEY) {
  console.error("WARNING: RESEND_API_KEY is not set — emails will not be delivered");
}

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_ADDRESS = "Cape Ann Nor'easters <admin@capeannnoreasters.com>";

interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}

export async function sendEmail(payload: EmailPayload): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: Array.isArray(payload.to) ? payload.to : [payload.to],
      subject: payload.subject,
      html: payload.html,
      ...(payload.replyTo ? { replyTo: payload.replyTo } : {}),
    });

    if (error) {
      console.error("Resend error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Email send failed:", message);
    return { success: false, error: message };
  }
}
