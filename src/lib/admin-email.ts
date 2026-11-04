import "server-only";

export function adminMagicLinkConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.ADMIN_EMAIL_FROM);
}

/** Sends the admin sign-in link. The URL is not logged. */
export async function sendAdminMagicLinkEmail(email: string, url: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ADMIN_EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error("Email sign-in is not configured.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Your #Hero admin sign-in link",
      text: [
        "Use this link to open the #Hero admin area. It expires in 5 minutes.",
        "",
        url,
        "",
        "If you did not ask for this, you can ignore this email.",
      ].join("\n"),
    }),
  });

  if (!response.ok) {
    console.error("Admin sign-in email failed", response.status);
    throw new Error("Could not send the sign-in email.");
  }
}
