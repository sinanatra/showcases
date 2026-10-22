export function download(blob, file) {
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"), { href: url, download: file }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
