export function shorten(text, maxLen = 300) {
  if (!text) return "";
  if (text.length <= maxLen) return text;
  let cut = text.lastIndexOf(" ", maxLen);
  if (cut === -1) cut = maxLen;
  return text.slice(0, cut) + "…";
}

export function shortenAroundKeyword(text, keyword, maxLen = 200) {
  if (!text || !keyword) return shorten(text, maxLen);
  const i = text.toLowerCase().indexOf(String(keyword).toLowerCase());
  if (i === -1) return shorten(text, maxLen);

  let start = Math.max(0, i - Math.floor((maxLen - keyword.length) / 2));
  let end = start + maxLen;

  if (end > text.length) {
    end = text.length;
    start = Math.max(0, end - maxLen);
  }

  if (start > 0) {
    const s = text.lastIndexOf(" ", start);
    if (s !== -1) start = s + 1;
  }

  if (end < text.length) {
    const s = text.indexOf(" ", end);
    if (s !== -1) end = s;
  }

  let result = text.slice(start, end);
  if (start > 0) result = "…" + result;
  if (end < text.length) result = result + "…";
  return result;
}
