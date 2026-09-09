import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ session: vi.fn(), items: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { checkSession: { findUniqueOrThrow: mock.session }, inventoryItem: { findMany: mock.items }, $transaction: mock.transaction } }));
import { POST } from "@/app/api/check/route";
beforeEach(() => {
  vi.clearAllMocks();
  mock.session.mockResolvedValue({ id: "s", status: "ACTIVE", scopeVersion: 1, expectedItemIds: ["a"], departmentId: "A", locationFilter: null, categoryFilter: null });
  mock.items.mockResolvedValue([{ id: "a", sku: "A1", labelCode: "1234567890", name: "Asset A" }]);
});
const request = (data: object) => new Request("http://localhost/api/check", { method: "POST", body: JSON.stringify({ sessionId: "s", value: "1234567890", ...data }) });
it("limits OCR candidate lookup to the saved session inventory", async () => {
  const response = await POST(request({ candidates: ["1234567890"] }));
  expect(response.status).toBe(200);
  expect(mock.items.mock.calls[0][0].where).toEqual({ AND: [{ archivedAt: null }, { id: { in: ["a"] } }] });
  expect((await response.json()).results[0].matches[0].item.id).toBe("a");
});
it("rejects confirmation of an item from another inventory without writes", async () => {
  const response = await POST(request({ itemId: "b" }));
  expect(response.status).toBe(400);
  expect(mock.transaction).not.toHaveBeenCalled();
});
it("rejects a completed session before searching or writing", async () => {
  mock.session.mockResolvedValue({ status: "COMPLETED" });
  expect((await POST(request({}))).status).toBe(400);
  expect(mock.items).not.toHaveBeenCalled();
  expect(mock.transaction).not.toHaveBeenCalled();
});
