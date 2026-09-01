export type Matchable = {
  id: string;
  sku: string | null;
  labelCode: string | null;
  inventoryCode?: string | null;
  productCode?: string;
  serialNumber?: string;
  name: string;
};
export function matchScan(value: string, items: Matchable[]) {
  const q = value.trim().toLowerCase();
  if (!q) return [];
  return items
    .map((item) => {
      const sku = item.sku?.toLowerCase(),
        label = item.labelCode?.toLowerCase(),
        inventoryCode = item.inventoryCode?.toLowerCase(),
        productCode = item.productCode?.toLowerCase(),
        serialNumber = item.serialNumber?.toLowerCase(),
        name = item.name.toLowerCase();
      let confidence = 0;
      if ([label, sku, inventoryCode, productCode, serialNumber].includes(q)) confidence = 1;
      else if (q === name) confidence = 0.95;
      else if ([label, sku, inventoryCode, productCode, serialNumber].some((code) => code?.includes(q))) confidence = 0.82;
      else if (name.includes(q) || q.includes(name)) confidence = 0.7;
      return { item, confidence };
    })
    .filter((x) => x.confidence > 0)
    .sort((a, b) => b.confidence - a.confidence);
}
