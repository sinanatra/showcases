export function detectRegion(a) {
  const src = String(a?.SourceFile || "").toLowerCase();
  const url = String(a?.URL || "").toLowerCase();
  if (src.includes("berlin") || url.includes("berlin.de")) return "Berlin";
  if (src.includes("brandenburg") || url.includes("brandenburg.de"))
    return "Brandenburg";
  return "";
}
