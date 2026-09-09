import { describe, expect, it, vi, beforeEach } from "vitest";
import { sessionItemWhere, sessionStats } from "./session-scope";

const scope = { departmentId: "A", locationFilter: null, categoryFilter: null, scopeVersion: 1, expectedItemIds: ["a1", "a2"] };
describe("session item scope", () => {
  it("uses the fixed list even after department or location changes", () => {
    expect(sessionItemWhere({ ...scope, departmentId: "B", locationFilter: "new" })).toEqual({ id: { in: ["a1", "a2"] } });
  });
  it("does not expand an empty snapshot to all items", () => {
    expect(sessionItemWhere({ ...scope, expectedItemIds: [] })).toEqual({ id: { in: [] } });
  });
  it("intersects department with optional location/category filters", () => {
    expect(sessionItemWhere({ ...scope, scopeVersion: 0, locationFilter: "Office", categoryFilter: "IT" })).toEqual({ archivedAt: null, departmentId: "A", OR: [{ userLocation: "Office" }, { location: "Office" }], category: "IT" });
  });
  it("ignores logs from another inventory and counts repeated checks once", () => {
    expect(sessionStats([{ id: "a1", status: "Checked" }, { id: "a2", status: "Missing" }], [{ itemId: "a1" }, { itemId: "a1" }, { itemId: "b1" }])).toEqual({ expected: 2, checked: 1, unchecked: 1, missing: 1 });
  });
});

const mocks = vi.hoisted(() => ({ findDepartment: vi.fn(), findItems: vi.fn(), create: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { $transaction: mocks.transaction } }));
import { POST } from "@/app/api/sessions/route";
describe("create department check session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findDepartment.mockResolvedValue({ id: "A", name: "Department A" });
    mocks.findItems.mockResolvedValue([{ id: "a1" }, { id: "a2" }]);
    mocks.create.mockImplementation(async ({ data }) => ({ id: "session", ...data }));
    mocks.transaction.mockImplementation(async callback => callback({ department: { findUniqueOrThrow: mocks.findDepartment }, inventoryItem: { findMany: mocks.findItems }, checkSession: { create: mocks.create } }));
  });
  it("stores only the department query result in the snapshot", async () => {
    const response = await POST(new Request("http://localhost/api/sessions", { method: "POST", body: JSON.stringify({ name: "Review", departmentId: "A" }) }));
    expect(response.status).toBe(201);
    expect(mocks.findItems).toHaveBeenCalledWith({ where: { archivedAt: null, departmentId: "A" }, select: { id: true } });
    expect(await response.json()).toMatchObject({ departmentId: "A", departmentName: "Department A", scopeVersion: 1, expectedItemIds: ["a1", "a2"] });
  });
  it("rejects all-inventory creation before a database write", async () => {
    const response = await POST(new Request("http://localhost/api/sessions", { method: "POST", body: JSON.stringify({ name: "Review", departmentId: "" }) }));
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
