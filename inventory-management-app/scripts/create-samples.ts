import * as XLSX from "xlsx";
import fs from "node:fs";
import path from "node:path";
const good = [
  {
    SKU: "SKU-2001",
    "Label Code": "489000200001",
    "Item Name": "A4 影印紙",
    Description: "80gsm",
    Category: "文具",
    Quantity: 10,
    Unit: "箱",
    Location: "E-01",
    "Minimum Stock": 3,
    Status: "Unchecked",
    Remark: "",
  },
  {
    SKU: "SKU-1002",
    "Label Code": "489000100002",
    "Item Name": "熱感標籤打印機",
    Description: "更新測試",
    Category: "電子設備",
    Quantity: 6,
    Unit: "部",
    Location: "A-02",
    "Minimum Stock": 2,
    Status: "Unchecked",
    Remark: "由 Excel 更新",
  },
];
const bad = [
  ...good,
  {
    SKU: "SKU-ERR-1",
    "Label Code": "",
    "Item Name": "錯誤負數",
    Category: "測試",
    Quantity: -3,
  },
  { SKU: "", "Label Code": "", "Item Name": "缺少唯一識別", Quantity: 2 },
  {
    SKU: "SKU-2001",
    "Label Code": "DUP",
    "Item Name": "重複 SKU",
    Quantity: "abc",
  },
];
fs.mkdirSync("samples", { recursive: true });
for (const [name, rows] of [
  ["inventory-sample.xlsx", good],
  ["inventory-with-errors.xlsx", bad],
] as const) {
  const wb = XLSX.utils.book_new(),
    ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [12, 16, 22, 18, 14, 10, 10, 12, 15, 14, 24].map((wch) => ({
    wch,
  }));
  XLSX.utils.book_append_sheet(wb, ws, "Inventory");
  XLSX.writeFile(wb, path.join("samples", name));
}
