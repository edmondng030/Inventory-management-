import { describe, expect, it } from "vitest";
import { itemSchema, safeCell } from "./inventory";
import { autoMap, parseRows } from "./excel";
import { matchScan } from "./scanner";
import { extractLabelNumber } from "./label";
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
  it("maps the referenced inventory workbook columns", () => {
    const headers = ["PO No.", "Inventory Code", "Product Code", "Product Description", "Qty", "Serial No.", "User/ Location", "Status"];
    expect(autoMap(headers)).toMatchObject({
      poNumber: "PO No.",
      inventoryCode: "Inventory Code",
      productCode: "Product Code",
      name: "Product Description",
      quantity: "Qty",
      serialNumber: "Serial No.",
      userLocation: "User/ Location",
      status: "Status",
    });
    const parsed = parseRows([{ "PO No.": "70_EPO-24-03448", "Inventory Code": 7020030912, "Product Code": 2005188, "Product Description": "Laptop", Qty: 1, "Serial No.": "ABC123", "User/ Location": "Raina WONG", Status: "Y" }], autoMap(headers));
    expect(parsed.errors).toHaveLength(0);
    expect(parsed.valid[0]).toMatchObject({ inventoryCode: "7020030912", productCode: "2005188", name: "Laptop", quantity: 1, serialNumber: "ABC123", userLocation: "Raina WONG", status: "Checked" });
  });
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
    { id: "1", sku: "SKU-1", labelCode: "489123", inventoryCode: "7020030912", productCode: "2005188", serialNumber: "ABC123", name: "藍色箱" },
  ];
  it("exact label is certain", () =>
    expect(matchScan("489123", items)[0].confidence).toBe(1));
  it("inventory code is an exact match", () =>
    expect(matchScan("7020030912", items)[0].confidence).toBe(1));
  it("name gives candidate", () =>
    expect(matchScan("藍色", items)[0].confidence).toBe(0.7));
});
describe("export safety", () => {
  it.each(["=cmd", "+SUM(1)", "-1", "@A1"])("escapes formula-like %s", (v) =>
    expect(safeCell(v).startsWith("'")).toBe(true),
  );
  it("keeps normal text", () => expect(safeCell("SKU-1")).toBe("SKU-1"));
});

describe("label OCR extraction", () => {
  it("prioritizes the numeric inventory label beside DPO", () => {
    expect(extractLabelNumber("DPO 7020031818\n70_EPO-24-03449")).toBe("7020031818");
  });
  it("repairs common OCR letter substitutions in a tagged number", () => {
    expect(extractLabelNumber("DPO 7O2OO3I8I8")).toBe("7020031818");
  });
});
