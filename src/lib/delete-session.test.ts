import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  user: vi.fn(),
  transaction: vi.fn(),
  lock: vi.fn(),
  find: vi.fn(),
  detach: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireUser: mock.user }));
vi.mock("@/lib/db", () => ({ db: { $transaction: mock.transaction } }));

import { DELETE } from "@/app/api/sessions/[id]/route";

const request = () => DELETE(new Request("http://localhost/api/sessions/session-1", { method: "DELETE" }), { params: Promise.resolve({ id: "session-1" }) });

describe("delete check session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.user.mockResolvedValue({ name: "Edmond", role: "ADMIN" });
    mock.find.mockResolvedValue({ id: "session-1", name: "September Check", status: "COMPLETED", _count: { checkLogs: 3 } });
    mock.detach.mockResolvedValue({ count: 3 });
    mock.remove.mockResolvedValue({ id: "session-1" });
    mock.transaction.mockImplementation(async callback => callback({
      $queryRaw: mock.lock,
      checkSession: { findUniqueOrThrow: mock.find, delete: mock.remove },
      checkLog: { updateMany: mock.detach },
    }));
  });

  it("keeps check logs by detaching them before deleting the session", async () => {
    const response = await request();
    expect(response.status).toBe(200);
    expect(mock.detach).toHaveBeenCalledWith({ where: { sessionId: "session-1" }, data: { sessionId: null } });
    expect(mock.remove).toHaveBeenCalledWith({ where: { id: "session-1" } });
    expect(await response.json()).toMatchObject({ ok: true, name: "September Check", preservedCheckLogs: 3 });
  });

  it("rejects a non-admin before starting a transaction", async () => {
    mock.user.mockResolvedValue({ name: "User", role: "USER" });
    const response = await request();
    expect(response.status).toBe(403);
    expect(mock.transaction).not.toHaveBeenCalled();
  });

  it("requires a signed-in user", async () => {
    mock.user.mockRejectedValue(new Error("請先登入"));
    expect((await request()).status).toBeGreaterThanOrEqual(400);
    expect(mock.transaction).not.toHaveBeenCalled();
  });
});
