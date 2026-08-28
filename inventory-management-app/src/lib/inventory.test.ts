import { describe, expect, it } from "vitest";
import { itemSchema, safeCell } from "./inventory";
import { autoMap, parseRows } from "./excel";
import { matchScan } from "./scanner";
describe("inventory validation", () => {
  it("rejects negative quantity", () =>
    expect(() =>
      itemSchema.parse({ sku: "A", name: "x", quantity: -1 }),
    ).toThrow());
  it("requires a code", () =>
    expect(() => itemSchema.parse({ name: "x", quantity: 1 })).toThrow());
  it("accepts zero quantity", () =>
    expect(
      itemSchema.parse({ sku: "A", name: "x", quantity: 0 }).quantity,
    ).toBe(0));
});
describe("Excel mapping and validation", () => {
  it("maps Chinese and English headers", () =>
    expect(autoMap(["SKU", "品名", "數量"])).toMatchObject({
      sku: "SKU",
      name: "品名",
      quantity: "數量",
    }));
  it("separates valid and invalid rows", () => {
    const x = parseRows(
      [
        { SKU: "A", 品名: "正常", 數量: 2 },
        { SKU: "B", 品名: "錯誤", 數量: -2 },
      ],
      autoMap(["SKU", "品名", "數量"]),
    );
    expect(x.valid).toHaveLength(1);
    expect(x.errors).toHaveLength(1);
  });
  it("catches duplicate sku", () => {
    const m = autoMap(["SKU", "Item Name", "Quantity"]);
    const x = parseRows(
      [
        { SKU: "A", "Item Name": "x", Quantity: 1 },
        { SKU: "A", "Item Name": "y", Quantity: 2 },
      ],
      m,
    );
    expect(x.errors[0].message).toContain("重複");
  });
});
describe("scanner matching", () => {
  const items = [
    { id: "1", sku: "SKU-1", labelCode: "489123", name: "藍色箱" },
  ];
  it("exact label is certain", () =>
    expect(matchScan("489123", items)[0].confidence).toBe(1));
  it("name gives candidate", () =>
    expect(matchScan("藍色", items)[0].confidence).toBe(0.7));
});
describe("export safety", () => {
  it.each(["=cmd", "+SUM(1)", "-1", "@A1"])("escapes formula-like %s", (v) =>
    expect(safeCell(v).startsWith("'")).toBe(true),
  );
  it("keeps normal text", () => expect(safeCell("SKU-1")).toBe("SKU-1"));
});
