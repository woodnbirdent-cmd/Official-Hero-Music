export function isMp3File(file: File, maxBytes: number): boolean {
  if (!file.name.toLowerCase().endsWith(".mp3")) return false;
  if (file.type && file.type !== "audio/mpeg" && file.type !== "audio/mp3") return false;
  if (file.size <= 0 || file.size > maxBytes) return false;
  return true;
}
