export const TIME_LABELS = {
  en: {
    Morning: "Morning",
    Afternoon: "Afternoon",
    Evening: "Evening",
    Night: "Night",
  },
  de: {
    Morning: "Morgen",
    Afternoon: "Nachmittag",
    Evening: "Abend",
    Night: "Nacht",
  },
};

export function timeCluster(h) {
  if (h >= 6 && h < 12) return "Morning";
  if (h >= 12 && h < 18) return "Afternoon";
  if (h >= 18 && h < 24) return "Evening";
  return "Night";
}
