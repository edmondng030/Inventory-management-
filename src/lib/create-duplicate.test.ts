import { beforeEach, expect, it, vi } from "vitest";
import { itemSchema } from "./inventory";
import { apiError } from "./http";
const mock = vi.hoisted(() => ({ find: vi.fn(), create: vi.fn(), audit: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { $transaction: mock.transaction } }));
import { POST } from "@/app/api/items/route";
beforeEach(() => {
  vi.clearAllMocks();
  mock.transaction.mockImplementation(async callback => callback({ inventoryItem: { findFirst: mock.find, create: mock.create }, auditLog: { create: mock.audit } }));
});
it("normalizes whitespace-only unique codes to null", () => {
  expect(itemSchema.parse({ sku: "A", inventoryCode: "  ", labelCode: "\t", name: "Asset", quantity: 1 })).toMatchObject({ inventoryCode: null, labelCode: null });
});
it.each([null, new Date()])("explains duplicate item including archive state without creating", async archivedAt => {
  mock.find.mockResolvedValue({ name: "Existing", inventoryCode: "A1", sku: null, labelCode: null, department: { name: "IT" }, archivedAt });
  const response = await POST(new Request("http://localhost/api/items", { method: "POST", body: JSON.stringify({ inventoryCode: "a1", name: "New", quantity: 1 }) }));
  expect(response.status).toBe(409);
  const result = await response.json();
  expect(result.error).toContain("Existing");
  expect(result.error).toContain("IT");
  if (archivedAt) expect(result.error).toContain("已封存");
  expect(mock.create).not.toHaveBeenCalled();
  expect(mock.audit).not.toHaveBeenCalled();
});
it("creates a new unique item and logs it", async () => {
  mock.find.mockResolvedValue(null);
  mock.create.mockResolvedValue({ id: "new" });
  const response = await POST(new Request("http://localhost/api/items", { method: "POST", body: JSON.stringify({ inventoryCode: "A2", name: "New", quantity: 1 }) }));
  expect(response.status).toBe(201);
  expect(mock.audit).toHaveBeenCalled();
});
it("hides Prisma internals for concurrent duplicate insertion", async () => {
  const response = apiError(Object.assign(new Error("prisma.inventoryItem.create internal"), { code: "P2002" }));
  expect(response.status).toBe(409);
  expect((await response.json()).error).not.toContain("prisma");
});
