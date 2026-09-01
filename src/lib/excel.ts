import * as XLSX from "xlsx";
import { itemSchema, safeCell, type ItemInput } from "./inventory";
export const fields = [
  "sku",
  "labelCode",
  "poNumber",
  "inventoryCode",
  "productCode",
  "serialNumber",
  "userLocation",
  "name",
  "description",
  "category",
  "quantity",
  "unit",
  "location",
  "minimumStock",
  "status",
  "remark",
] as const;
export type Field = (typeof fields)[number];
const aliases: Record<Field, string[]> = {
  sku: ["sku", "item id", "貨號", "產品編號"],
  labelCode: ["label code", "label", "標籤編號", "條碼"],
  poNumber: ["po no.", "po no", "po number", "purchase order", "採購單號"],
  inventoryCode: ["inventory code", "inventory no.", "inventory no", "資產編號", "庫存編號"],
  productCode: ["product code", "product no.", "產品代碼", "產品編號"],
  serialNumber: ["serial no.", "serial no", "serial number", "s/n", "序號"],
  userLocation: ["user/ location", "user/location", "user / location", "user location", "用戶/位置", "使用者/位置"],
  name: ["product description", "item name", "name", "名稱", "品名", "產品描述"],
  description: ["description", "描述"],
  category: ["category", "類別", "分類"],
  quantity: ["quantity", "qty", "數量"],
  unit: ["unit", "單位"],
  location: ["location", "位置", "地點", "倉位"],
  minimumStock: ["minimum stock", "min stock", "最低庫存"],
  status: ["status", "狀態"],
  remark: ["remark", "remarks", "備註"],
};
export function autoMap(headers: string[]) {
  const out: Partial<Record<Field, string>> = {};
  for (const h of headers) {
    const key = h.trim().toLowerCase();
    for (const f of fields) if (aliases[f].includes(key)) out[f] = h;
  }
  return out;
}
export function parseRows(
  rows: Record<string, unknown>[],
  mapping: Partial<Record<Field, string>>,
) {
  const valid: ItemInput[] = [];
  const errors: { row: number; message: string }[] = [];
  const seen = new Set<string>();
  rows.forEach((row, idx) => {
    const raw: Record<string, unknown> = {};
    fields.forEach((f) => {
      const h = mapping[f];
      if (h)
        raw[f] =
          typeof row[h] === "string" ? (row[h] as string).trim() : row[h];
    });
    if (!Object.values(raw).some((v) => v !== "" && v != null)) return;
    const parsed = itemSchema.safeParse(raw);
    if (!parsed.success)
      return void errors.push({
        row: idx + 2,
        message: parsed.error.issues.map((i) => i.message).join("; "),
      });
    const key = (parsed.data.inventoryCode || parsed.data.sku || parsed.data.labelCode)!.toLowerCase();
    if (seen.has(key))
      return void errors.push({
        row: idx + 2,
        message: "檔案內有重複 Inventory Code／SKU／Label Code",
      });
    seen.add(key);
    valid.push(parsed.data);
  });
  return { valid, errors };
}
export function parseWorkbook(buffer: ArrayBuffer) {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  return { sheets: workbook.SheetNames, workbook };
}
export function sheetRows(wb: XLSX.WorkBook, name: string) {
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[name], {
    defval: "",
  });
}
export function exportCell(v: unknown) {
  return typeof v === "string" ? safeCell(v) : v;
}
