export const berlinDistricts = [
  "Mitte",
  "Friedrichshain-Kreuzberg",
  "Pankow",
  "Charlottenburg-Wilmersdorf",
  "Spandau",
  "Steglitz-Zehlendorf",
  "Tempelhof-Schöneberg",
  "Neukölln",
  "Treptow-Köpenick",
  "Marzahn-Hellersdorf",
  "Lichtenberg",
  "Reinickendorf",
];

export const brandenburgCounties = [
  "Barnim",
  "Dahme-Spreewald",
  "Elbe-Elster",
  "Havelland",
  "Märkisch-Oderland",
  "Oberhavel",
  "Oberspreewald-Lausitz",
  "Oder-Spree",
  "Ostprignitz-Ruppin",
  "Potsdam-Mittelmark",
  "Prignitz",
  "Spree-Neiße",
  "Uckermark",
];

export const brandenburgCities = [
  "Potsdam",
  "Brandenburg an der Havel",
  "Cottbus",
  "Frankfurt (Oder)",
];

export function normalizeDistrict(value, region) {
  if (!value) return "";
  const s = String(value).replace(/\s+/g, " ").trim();
  const parts = s
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const all = parts.length ? parts : [s];
  const last = all[all.length - 1];
  const matchOne = (list) => {
    for (const name of list) {
      if (
        all.some(
          (t) =>
            t === name || t.replace(/\s+/g, "") === name.replace(/\s+/g, "")
        )
      )
        return name;
      if (s.includes(name)) return name;
    }
    return null;
  };
  if (region === "Berlin") {
    const m = matchOne(berlinDistricts);
    return m || last;
  }
  if (region === "Brandenburg") {
    const c = matchOne(brandenburgCities);
    if (c) return c;
    const k = matchOne(brandenburgCounties);
    if (k) return k;
    return last;
  }
  return last;
}
