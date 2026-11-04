export function requestIsSameOrigin(requestUrl: string, originHeader: string | null): boolean {
  if (!originHeader) return false;
  try {
    return new URL(originHeader).origin === new URL(requestUrl).origin;
  } catch {
    return false;
  }
}

export function siteOriginFromRequest(requestUrl: string): string {
  try {
    const url = new URL(requestUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("bad origin");
    return url.origin;
  } catch {
    return "https://officialheromusic.com";
  }
}
