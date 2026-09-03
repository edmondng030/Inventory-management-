const repairDigits = (value: string) => value.replace(/[OQD]/g, "0").replace(/[IL|]/g, "1").replace(/Z/g, "2").replace(/S/g, "5").replace(/B/g, "8").replace(/\D/g, "");

export function extractLabelCandidates(text: string) {
  const normalized = text.normalize("NFKC").toUpperCase();
  const found: { value: string; tagged: boolean }[] = [];
  for (const match of normalized.matchAll(/(?:DPO|INVENTORY(?:\s+CODE)?|ASSET(?:\s+NO\.?)?)\s*[:#-]?[ \t]*([0-9OQDIL|ZSB \t-]{8,28})/g)) {
    const value = repairDigits(match[1]);
    if (value.length >= 8 && value.length <= 14) found.push({ value, tagged: true });
  }
  for (const match of normalized.matchAll(/(?<![A-Z0-9])([0-9OQDIL|ZSB](?:[0-9OQDIL|ZSB \t-]{6,24})[0-9OQDIL|ZSB])(?![A-Z0-9])/g)) {
    const raw = match[1];
    if ((raw.match(/\d/g) || []).length < 6) continue;
    const value = repairDigits(raw);
    if (value.length >= 8 && value.length <= 14) found.push({ value, tagged: false });
  }
  return [...new Map(found.sort((a,b)=>Number(b.tagged)-Number(a.tagged)||Number(b.value.length===10)-Number(a.value.length===10)).map(x=>[x.value,x.value])).values()];
}

export function extractLabelNumber(text: string) { return extractLabelCandidates(text)[0] || null; }
