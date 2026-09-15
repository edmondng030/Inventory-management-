import { describe, expect, it } from "vitest";
import { visibleInventoryItems } from "./inventory-view";

describe("inventory list display mode", () => {
  const items = Array.from({ length: 20 }, (_, index) => index + 1);
  it("shows only the requested page in paged mode", () => {
    expect(visibleInventoryItems(items, "paged", 2, 8)).toEqual([9, 10, 11, 12, 13, 14, 15, 16]);
  });
  it("shows every filtered item in scroll mode", () => {
    expect(visibleInventoryItems(items, "scroll", 4, 8)).toEqual(items);
  });
});
