export type InventoryListMode = "paged" | "scroll";

export function visibleInventoryItems<T>(items: T[], mode: InventoryListMode, page: number, perPage = 8) {
  return mode === "scroll" ? items : items.slice((page - 1) * perPage, page * perPage);
}
