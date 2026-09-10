import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ items: vi.fn(), item: vi.fn(), update: vi.fn(), log: vi.fn(), audit: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { inventoryItem: { findMany: mock.items, findUniqueOrThrow: mock.item }, $transaction: mock.transaction } }));
import { POST } from "@/app/api/check/route";
beforeEach(() => {
  vi.clearAllMocks();
  const item = { id: "a", name: "Asset", sku: "A", status: "Unchecked", userLocation: "Office A" };
  mock.items.mockResolvedValue([item]);
  mock.item.mockResolvedValue(item);
  mock.update.mockImplementation(async ({ data }) => ({ ...item, ...data }));
  mock.log.mockResolvedValue({ id: "log" });
  mock.audit.mockResolvedValue({});
  mock.transaction.mockImplementation(async callback => callback({ inventoryItem: { update: mock.update }, checkLog: { create: mock.log }, auditLog: { create: mock.audit } }));
});
const request = (extra: object) => new Request("http://localhost/api/check", { method: "POST", body: JSON.stringify({ value: "A", itemId: "a", method: "OCR", ...extra }) });
it("saves trimmed location with checked time and audits old/new values", async () => {
  expect((await POST(request({ userLocation: " Office B " }))).status).toBe(200);
  expect(mock.update.mock.calls[0][0].data).toMatchObject({ userLocation: "Office B", status: "Checked", lastCheckedAt: expect.any(Date) });
  const audit = mock.audit.mock.calls[0][0].data;
  expect(JSON.parse(audit.previousValue).userLocation).toBe("Office A");
  expect(JSON.parse(audit.newValue).userLocation).toBe("Office B");
});
it("preserves location when no edit is sent", async () => {
  await POST(request({}));
  expect(mock.update.mock.calls[0][0].data).not.toHaveProperty("userLocation");
});
it.each([null, 123, "x".repeat(301)])("rejects invalid location without writes", async userLocation => {
  expect((await POST(request({ userLocation }))).status).toBe(400);
  expect(mock.transaction).not.toHaveBeenCalled();
});
