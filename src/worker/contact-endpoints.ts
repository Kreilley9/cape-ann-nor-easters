import { Hono } from "hono";
import type { Env } from "@/shared/types";

export function setupContactEndpoints(app: Hono<{ Bindings: Env }>) {
  // Submit contact form
  app.post("/api/public/contact", async (c) => {
    try {
      const body = await c.req.json();
      const { name, email, phone, preferredContact, subject, message } = body;

      // Validate required fields
      if (!name || !email || !phone || !preferredContact || !subject || !message) {
        return c.json({ error: "All fields are required" }, 400);
      }

      // Send email notification (only in production - detect by checking host)
      const host = c.req.header("host") || "";
      const isProduction = host.includes("mocha.app") || host.includes("capeannnoreasters.com");
      console.log("Contact form host:", host, "isProduction:", isProduction);
      
      if (isProduction) {
        console.log("Attempting to send contact form email to kevin@capeannnoreasters.com");
        
        const emailHtml = `
          <h2>New Contact Form Submission</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${phone}</p>
          <p><strong>Preferred Contact:</strong> ${preferredContact}</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <p><strong>Message:</strong></p>
          <p>${message.replace(/\n/g, '<br>')}</p>
        `;

        const emailText = `
New Contact Form Submission

Name: ${name}
Email: ${email}
Phone: ${phone}
Preferred Contact: ${preferredContact}
Subject: ${subject}

Message:
${message}
        `;

        try {
          const emailResult = await c.env.EMAILS.send({
            to: "kevin@capeannnoreasters.com",
            subject: `Contact Form: ${subject}`,
            html_body: emailHtml,
            text_body: emailText,
          });
          console.log("Email send result:", emailResult);
        } catch (emailError) {
          console.error("Error sending contact form email:", emailError);
          throw emailError;
        }
      } else {
        console.log("Skipping email send in development (host:", host, ")");
      }

      return c.json({ success: true });
    } catch (error) {
      console.error("Error submitting contact form:", error);
      return c.json({ error: "Failed to submit contact form" }, 500);
    }
  });

  // Submit sponsorship inquiry
  app.post("/api/public/sponsorship", async (c) => {
    try {
      const body = await c.req.json();
      const { companyName, contactName, email, phone, tier, message } = body;

      // Validate required fields
      if (!companyName || !contactName || !email || !phone) {
        return c.json({ error: "Required fields are missing" }, 400);
      }

      // Send email notification (only in production - detect by checking host)
      const host = c.req.header("host") || "";
      const isProduction = host.includes("mocha.app") || host.includes("capeannnoreasters.com");
      console.log("Sponsorship form host:", host, "isProduction:", isProduction);
      
      if (isProduction) {
        console.log("Attempting to send sponsorship email to kevin@capeannnoreasters.com");
        
        const emailHtml = `
          <h2>New Sponsorship Inquiry</h2>
          <p><strong>Company:</strong> ${companyName}</p>
          <p><strong>Contact Name:</strong> ${contactName}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${phone}</p>
          ${tier ? `<p><strong>Interested Level:</strong> ${tier}</p>` : ''}
          ${message ? `<p><strong>Message:</strong></p><p>${message.replace(/\n/g, '<br>')}</p>` : ''}
        `;

        const emailText = `
New Sponsorship Inquiry

Company: ${companyName}
Contact Name: ${contactName}
Email: ${email}
Phone: ${phone}
${tier ? `Interested Level: ${tier}` : ''}
${message ? `\nMessage:\n${message}` : ''}
        `;

        try {
          const emailResult = await c.env.EMAILS.send({
            to: "kevin@capeannnoreasters.com",
            subject: `Sponsorship Inquiry from ${companyName}`,
            html_body: emailHtml,
            text_body: emailText,
          });
          console.log("Email send result:", emailResult);
        } catch (emailError) {
          console.error("Error sending sponsorship email:", emailError);
          throw emailError;
        }
      } else {
        console.log("Skipping email send in development (host:", host, ")");
      }

      return c.json({ success: true });
    } catch (error) {
      console.error("Error submitting sponsorship inquiry:", error);
      return c.json({ error: "Failed to submit sponsorship inquiry" }, 500);
    }
  });
}
