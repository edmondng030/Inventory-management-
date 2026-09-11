import { expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ sessions: vi.fn(), items: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { checkSession: { findMany: mock.sessions }, inventoryItem: { findMany: mock.items } } }));
import { GET } from "@/app/api/sessions/route";
it("returns complete checked item details with this session's logs only", async () => {
  const log = { id: "log1", itemId: "a", checkedAt: "2026-09-11", checkedBy: "Edmond", detectionMethod: "OCR", detectedValue: "702001" };
  mock.sessions.mockResolvedValue([{ id: "session1", scopeVersion: 1, expectedItemIds: ["a", "b"], checkLogs: [log, { id: "outside", itemId: "other" }] }]);
  mock.items.mockResolvedValue([{ id: "a", name: "Laptop", inventoryCode: "702001", status: "Checked", userLocation: "Office", quantity: 1, serialNumber: "SN1", poNumber: "PO1", remark: "Note", department: { name: "IT" } }, { id: "b", name: "Monitor", status: "Unchecked" }]);
  const response = await GET(new Request("http://localhost/api/sessions?departmentId=IT"));
  const [session] = await response.json();
  expect(mock.sessions.mock.calls[0][0].where).toEqual({ departmentId: "IT" });
  expect(session.checkedItems).toHaveLength(1);
  expect(session.checkedItems[0]).toMatchObject({ id: "a", userLocation: "Office", serialNumber: "SN1", poNumber: "PO1", quantity: 1, remark: "Note", sessionChecks: [log] });
  expect(session.stats).toMatchObject({ expected: 2, checked: 1, unchecked: 1 });
});
