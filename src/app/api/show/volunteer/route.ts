import { NextResponse } from "next/server";
import { deliverVolunteerNotice } from "@/lib/show-fulfill";
import { requestIsSameOrigin, siteOriginFromRequest } from "@/lib/show-http";
import { parseVolunteerFields } from "@/lib/show-input";
import { ShowError, createVolunteerOrder, showErrorStatus } from "@/lib/show-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!requestIsSameOrigin(request.url, request.headers.get("origin"))) {
    return NextResponse.json({ error: "Could not save that sign-up." }, { status: 403 });
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const text = (key: string) => {
    const value = form.get(key);
    return typeof value === "string" ? value : "";
  };
  const parsed = parseVolunteerFields({
    name: text("name"),
    email: text("email"),
    phone: text("phone"),
    shifts: form.getAll("availability").filter((item): item is string => typeof item === "string"),
    roles: form.getAll("role").filter((item): item is string => typeof item === "string"),
    roleOther: text("roleOther"),
    shirtSize: text("shirtSize"),
    notes: text("notes"),
    companyWebsite: text("company_website"),
  });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (parsed.value.spam) return NextResponse.json({ ok: true });

  try {
    const id = await createVolunteerOrder({
      buyerName: parsed.value.name,
      buyerEmail: parsed.value.email,
      phone: parsed.value.phone,
      availability: parsed.value.availability,
      roleInterest: parsed.value.roleInterest,
      shirtSize: parsed.value.shirtSize,
      notes: parsed.value.notes,
      siteOrigin: siteOriginFromRequest(request.url),
    });
    await deliverVolunteerNotice(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ShowError) {
      return NextResponse.json({ error: error.message }, { status: showErrorStatus(error) });
    }
    console.error("Volunteer sign-up failed");
    return NextResponse.json({ error: "Could not save that sign-up." }, { status: 500 });
  }
}
