import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  user: vi.fn(), transaction: vi.fn(), department: vi.fn(), find: vi.fn(), update: vi.fn(), audit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireUser: mock.user }));
vi.mock("@/lib/db", () => ({ db: { department: { findUnique: mock.department }, $transaction: mock.transaction } }));

import { POST } from "@/app/api/items/bulk/route";

const request = (body: unknown) => POST(new Request("http://localhost/api/items/bulk", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
}));

describe("bulk item status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.user.mockResolvedValue({ name: "Edmond" });
    mock.transaction.mockImplementation(async (callback) => callback({
      inventoryItem: { findUniqueOrThrow: mock.find, update: mock.update }, auditLog: { create: mock.audit },
    }));
  });

  it("changes multiple selected items and writes an audit log for each", async () => {
    mock.find.mockResolvedValueOnce({ id: "a", status: "Unchecked", archivedAt: null }).mockResolvedValueOnce({ id: "b", status: "Damaged", archivedAt: null });
    mock.update.mockResolvedValueOnce({ id: "a", status: "Checked", archivedAt: null }).mockResolvedValueOnce({ id: "b", status: "Checked", archivedAt: null });
    const response = await request({ ids: ["a", "b"], status: "Checked" });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ updatedCount: 2, skippedCount: 0 });
    expect(mock.update).toHaveBeenCalledTimes(2);
    expect(mock.update).toHaveBeenNthCalledWith(1, { where: { id: "a" }, data: { status: "Checked" } });
    expect(mock.audit).toHaveBeenCalledTimes(2);
    expect(mock.audit.mock.calls[0][0].data).toMatchObject({ itemId: "a", action: "BULK_STATUS", source: "Manual", performedBy: "Edmond" });
  });

  it("skips borrowed, archived and already-matching items", async () => {
    mock.find.mockResolvedValueOnce({ id: "borrowed", status: "Borrowed", archivedAt: null }).mockResolvedValueOnce({ id: "archived", status: "Unchecked", archivedAt: new Date() }).mockResolvedValueOnce({ id: "same", status: "Missing", archivedAt: null });
    const response = await request({ ids: ["borrowed", "archived", "same"], status: "Missing" });
    expect(await response.json()).toMatchObject({ updatedCount: 0, skippedCount: 3 });
    expect(mock.update).not.toHaveBeenCalled();
    expect(mock.audit).not.toHaveBeenCalled();
  });

  it("deduplicates selected IDs before updating", async () => {
    mock.find.mockResolvedValue({ id: "a", status: "Unchecked", archivedAt: null });
    mock.update.mockResolvedValue({ id: "a", status: "Damaged", archivedAt: null });
    const response = await request({ ids: ["a", "a"], status: "Damaged" });
    expect(await response.json()).toMatchObject({ updatedCount: 1, skippedCount: 0 });
    expect(mock.find).toHaveBeenCalledTimes(1);
  });

  it("rejects unsupported statuses before opening a transaction", async () => {
    const response = await request({ ids: ["a"], status: "Deleted" });
    expect(response.status).toBe(400);
    expect(mock.transaction).not.toHaveBeenCalled();
  });
});
