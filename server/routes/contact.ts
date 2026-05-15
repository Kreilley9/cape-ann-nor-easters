import { Router } from "express";
import { sendEmail } from "../lib/email.ts";

export const contactRouter = Router();

contactRouter.post("/contact", async (req, res) => {
  const { name, email, phone, preferredContact, subject, message } = req.body;
  if (!name || !email || !phone || !preferredContact || !subject || !message) {
    res.status(400).json({ error: "All fields are required" });
    return;
  }

  await sendEmail({
    to: process.env.ADMIN_EMAIL ?? "admin@capeannnoreasters.com",
    subject: `Contact Form: ${subject}`,
    html: `<h2>New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>Preferred Contact:</strong> ${preferredContact}</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <p><strong>Message:</strong></p>
      <p>${message.replace(/\n/g, "<br>")}</p>`,
  });

  res.json({ success: true });
});

contactRouter.post("/sponsorship", async (req, res) => {
  const { companyName, contactName, email, phone, tier, message } = req.body;
  if (!companyName || !contactName || !email || !phone) {
    res.status(400).json({ error: "Required fields are missing" });
    return;
  }

  await sendEmail({
    to: process.env.ADMIN_EMAIL ?? "admin@capeannnoreasters.com",
    subject: `Sponsorship Inquiry from ${companyName}`,
    html: `<h2>New Sponsorship Inquiry</h2>
      <p><strong>Company:</strong> ${companyName}</p>
      <p><strong>Contact Name:</strong> ${contactName}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      ${tier ? `<p><strong>Interested Level:</strong> ${tier}</p>` : ""}
      ${message ? `<p><strong>Message:</strong></p><p>${message.replace(/\n/g, "<br>")}</p>` : ""}`,
  });

  res.json({ success: true });
});
