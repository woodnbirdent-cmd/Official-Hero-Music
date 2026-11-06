export const MAX_LOGO_BYTES = 2_000_000;

export function detectLogo(bytes: Uint8Array): "image/png" | "image/jpeg" | "image/webp" | null {
  if (bytes.length < 12 || bytes.length > MAX_LOGO_BYTES) return null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  const riff = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
  const webp = bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  if (riff && webp) return "image/webp";
  return null;
}

export function safeLogoFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() || "logo";
  const cleaned = base.replace(/[^A-Za-z0-9._-]/g, "").slice(0, 80);
  return cleaned || "logo";
}
