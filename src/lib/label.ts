export function extractLabelNumber(text: string) {
  const normalized = text.normalize("NFKC").toUpperCase();
  const tagged = normalized.match(/(?:DPO|INVENTORY(?:\s+CODE)?|ASSET(?:\s+NO\.?)?)\s*[:#-]?[ \t]*([0-9OIL \t-]{8,24})/);
  if (tagged) {
    const digits = tagged[1].replace(/O/g, "0").replace(/[IL]/g, "1").replace(/\D/g, "");
    if (digits.length >= 8 && digits.length <= 14) return digits;
  }
  const candidates = [...normalized.matchAll(/(?<!\d)(?:\d[ \t]*){8,14}(?!\d)/g)]
    .map((match) => match[0].replace(/\D/g, ""))
    .filter((value) => value.length >= 8 && value.length <= 14)
    .sort((a, b) => Number(b.length === 10) - Number(a.length === 10));
  return candidates[0] || null;
}
