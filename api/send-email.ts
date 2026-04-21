import { VercelRequest, VercelResponse } from "@vercel/node";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { to, subject, html } = req.body;

  if (!resend) {
    console.warn("RESEND_API_KEY not set. Email not sent.");
    return res.status(200).json({ success: true, message: "Email simulation: RESEND_API_KEY missing" });
  }

  try {
    const { data, error } = await resend.emails.send({
      from: "Ar-Rahman Academy <notifications@resend.dev>",
      to: [to],
      subject,
      html,
    });

    if (error) {
      console.error("Resend error:", error);
      return res.status(400).json({ error });
    }

    res.json({ success: true, data });
  } catch (err) {
    console.error("Server error sending email:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
