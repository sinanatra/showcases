const dateCache = new Map();

export function parseDateLoose(v) {
  if (!v) return null;
  const raw = String(v).trim().replace(/,/g, "");
  if (!raw) return null;
  if (dateCache.has(raw)) return dateCache.get(raw);

  let d = null;

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const [, y, m, day] = iso;
    d = new Date(Number(y), Number(m) - 1, Number(day));
  } else {
    const de = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
    if (de) {
      let [, day, month, year] = de;
      let y = Number(year);
      if (year.length === 2) y += y >= 70 ? 1900 : 2000;
      d = new Date(y, Number(month) - 1, Number(day));
    }
  }

  if (!d || isNaN(+d)) {
    const tmp = new Date(raw);
    d = isNaN(+tmp) ? null : tmp;
  }

  dateCache.set(raw, d);
  return d;
}
