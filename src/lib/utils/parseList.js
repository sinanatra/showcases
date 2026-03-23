export function parseList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  const raw = String(value).trim();
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw.replace(/'/g, '"'));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return raw
      .replace(/[\[\]'"]/g, "")
      .split(/[,;]\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
}
