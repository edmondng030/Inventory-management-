import { z } from "zod";
export const STATUSES = [
  "Checked",
  "Unchecked",
  "Missing",
  "Damaged",
  "Low Stock",
] as const;
const optionalText = z.preprocess(
  (v) => (v == null ? "" : String(v)),
  z.string().trim().default(""),
);
const optionalCode = z.preprocess(
  (v) => (v === "" || v == null ? null : String(v)),
  z.string().trim().optional().nullable(),
);
export const itemSchema = z
  .object({
    sku: optionalCode,
    labelCode: optionalCode,
    poNumber: optionalText,
    inventoryCode: optionalCode,
    productCode: optionalText,
    serialNumber: optionalText,
    userLocation: optionalText,
    name: z.string().trim().min(1, "Product Description 為必填"),
    description: z.string().trim().default(""),
    category: z.string().trim().default("未分類"),
    quantity: z.coerce.number().int().min(0, "數量不可為負數"),
    unit: z.string().trim().default("件"),
    location: z.string().trim().default("未指定"),
    minimumStock: z.coerce
      .number()
      .int()
      .min(0, "最低庫存不可為負數")
      .default(0),
    status: z.preprocess(
      (v) => {
        const value = String(v ?? "").trim().toLowerCase();
        if (["y", "yes", "checked"].includes(value)) return "Checked";
        if (["n", "no", ""].includes(value)) return "Unchecked";
        return v;
      },
      z.enum(STATUSES).default("Unchecked"),
    ),
    remark: z.string().trim().default(""),
  })
  .refine((v) => v.inventoryCode || v.sku || v.labelCode, {
    message: "Inventory Code、SKU 或 Label Code 至少需要一項",
  });
export type ItemInput = z.infer<typeof itemSchema>;
export function effectiveStatus(i: {
  status: string;
  quantity: number;
  minimumStock: number;
}) {
  return i.quantity <= i.minimumStock &&
    !["Missing", "Damaged"].includes(i.status)
    ? "Low Stock"
    : i.status;
}
export function safeCell(value: unknown) {
  const s = value == null ? "" : String(value);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}
