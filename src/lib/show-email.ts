import "server-only";
import QRCode from "qrcode";
import { ticketCheckinUrl } from "@/lib/show-codes";
import {
  ownerSponsorshipEmail,
  ownerVolunteerEmail,
  sponsorshipReceiptEmail,
  sponsorshipRequestEmail,
  ticketEmail,
  volunteerConfirmationEmail,
} from "@/lib/show-copy";
import { detectLogo } from "@/lib/show-logo";
import { readLogo } from "@/lib/show-store";
import type { ShowOrder } from "@/lib/show-types";

/** Lee McKinney / Woodnbird Entertainment. Same owner address already used for admin access. */
const DEFAULT_OWNER_NOTIFY_EMAIL = "woodnbirdent@gmail.com";

export function ownerNotifyEmail(env: NodeJS.ProcessEnv = process.env): string {
  return env.OWNER_NOTIFY_EMAIL?.trim() || DEFAULT_OWNER_NOTIFY_EMAIL;
}

type Attachment = {
  filename: string;
  content: Buffer;
  contentType: string;
  contentId?: string;
};

async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: Attachment[];
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ADMIN_EMAIL_FROM;
  if (!apiKey || !from) throw new Error("Email is not configured.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html,
      attachments: input.attachments?.map((item) => ({
        filename: item.filename,
        content: item.content.toString("base64"),
        content_type: item.contentType,
        ...(item.contentId ? { content_id: item.contentId } : {}),
      })),
    }),
  });
  if (!response.ok) {
    console.error("Show email failed", response.status);
    throw new Error("Could not send email.");
  }
}

export async function sendOrderBuyerEmail(order: ShowOrder): Promise<void> {
  if (order.kind === "ticket") {
    const body = ticketEmail(order, order.tickets);
    const origin = order.siteOrigin || "https://officialheromusic.com";
    const attachments = await Promise.all(
      order.tickets.map(async (ticket, index) => {
        const url = ticketCheckinUrl(origin, ticket.code);
        const png = await QRCode.toBuffer(url, {
          type: "png",
          width: 360,
          margin: 1,
          errorCorrectionLevel: "M",
        });
        return {
          filename: `ticket-${index + 1}.png`,
          content: png,
          contentType: "image/png",
          contentId: `ticket-qr-${index + 1}`,
        };
      }),
    );
    await sendEmail({ to: order.buyerEmail, ...body, attachments });
    return;
  }
  if (order.kind === "volunteer") {
    await sendEmail({ to: order.buyerEmail, ...volunteerConfirmationEmail(order) });
    return;
  }
  const body = order.status === "paid" ? sponsorshipReceiptEmail(order) : sponsorshipRequestEmail(order);
  await sendEmail({ to: order.buyerEmail, ...body });
}

export async function sendOrderOwnerEmail(order: ShowOrder): Promise<void> {
  const body = order.kind === "volunteer" ? ownerVolunteerEmail(order) : ownerSponsorshipEmail(order);
  const logo = order.logoDelivery === "upload" ? await readLogo(order.id) : null;
  const contentType = logo ? detectLogo(logo.bytes) || "application/octet-stream" : "";
  await sendEmail({
    to: ownerNotifyEmail(),
    ...body,
    attachments: logo ? [{ filename: logo.filename, content: logo.bytes, contentType }] : undefined,
  });
}
