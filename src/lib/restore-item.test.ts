import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ user: vi.fn(), list: vi.fn(), find: vi.fn(), update: vi.fn(), audit: vi.fn(), transaction: vi.fn(), lock: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { inventoryItem: { findMany: mock.list }, $transaction: mock.transaction } }));
vi.mock("@/lib/auth", () => ({ requireUser: mock.user }));
import { POST } from "@/app/api/items/[id]/restore/route";
import { GET } from "@/app/api/items/route";
beforeEach(() => {
  vi.clearAllMocks();
  mock.user.mockResolvedValue({ name: "Edmond" });
  mock.list.mockResolvedValue([]);
  mock.transaction.mockImplementation(async callback => callback({ $queryRaw: mock.lock, inventoryItem: { findUniqueOrThrow: mock.find, update: mock.update }, auditLog: { create: mock.audit } }));
});
const restore = () => POST(new Request("http://localhost/api/items/a/restore", { method: "POST" }), { params: Promise.resolve({ id: "a" }) });
it("restores the same item and audits without changing quantity, codes or review date", async () => {
  const old = { id: "a", inventoryCode: "702001", quantity: 1, departmentId: null, lastCheckedAt: "2026-09-01", archivedAt: new Date() };
  mock.find.mockResolvedValue(old);
  mock.update.mockResolvedValue({ ...old, archivedAt: null });
  expect((await restore()).status).toBe(200);
  expect(mock.update).toHaveBeenCalledWith({ where: { id: "a" }, data: { archivedAt: null } });
  const audit = mock.audit.mock.calls[0][0].data;
  expect(audit).toMatchObject({ action: "RESTORE", source: "Manual", performedBy: "Edmond" });
  expect(JSON.parse(audit.newValue)).toMatchObject({ id: "a", inventoryCode: "702001", lastCheckedAt: "2026-09-01", archivedAt: null });
});
it("does not write again when already restored", async () => {
  mock.find.mockResolvedValue({ id: "a", archivedAt: null });
  expect((await restore()).status).toBe(200);
  expect(mock.update).not.toHaveBeenCalled();
  expect(mock.audit).not.toHaveBeenCalled();
});
it("requires login before restoring", async () => {
  mock.user.mockRejectedValue(new Error("請先登入"));
  expect((await restore()).status).toBeGreaterThanOrEqual(400);
  expect(mock.transaction).not.toHaveBeenCalled();
});
it.each(["active", "archived", "all"])("queries the requested %s archive scope", async archive => {
  expect((await GET(new Request(`http://localhost/api/items?archive=${archive}&q=702001`))).status).toBe(200);
  const where = mock.list.mock.calls[0][0].where;
  if (archive === "all") expect(where).not.toHaveProperty("archivedAt");
  else expect(where.archivedAt).toEqual(archive === "active" ? null : { not: null });
  expect(where.AND[0].OR).toContainEqual({ inventoryCode: { contains: "702001", mode: "insensitive" } });
});
it("defaults normal searches to all items including archived", async () => {
  await GET(new Request("http://localhost/api/items"));
  expect(mock.list.mock.calls[0][0].where).not.toHaveProperty("archivedAt");
});
