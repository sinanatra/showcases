export function getMapViewLabel(regionFilter, districtFilter) {
  const rf = String(regionFilter || "all");
  const df = String(districtFilter || "");
  if (rf === "Berlin") {
    if (df) return `Berlin · ${df}`;
    return "Berlin";
  }
  if (rf === "Brandenburg") return "Brandenburg";
  if (rf === "all") return "Berlin + Brandenburg";
  return "";
}
