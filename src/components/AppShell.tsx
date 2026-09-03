"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Boxes,
  Building2,
  Camera,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  History,
  LayoutDashboard,
  KeyRound,
  Menu,
  LogOut,
  Minus,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  Upload,
  UserPlus,
  Trash2,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import { autoMap, fields, parseRows, type Field } from "@/lib/excel";
import { extractLabelCandidates } from "@/lib/label";
import { prepareOcrImages } from "@/lib/ocr-image";

type Item = {
  id: string;
  sku: string | null;
  labelCode: string | null;
  poNumber: string;
  inventoryCode: string | null;
  productCode: string;
  serialNumber: string;
  userLocation: string;
  name: string;
  description: string;
  category: string;
  quantity: number;
  unit: string;
  location: string;
  minimumStock: number;
  status: string;
  remark: string;
  lastCheckedAt: string | null;
  updatedAt: string;
  departmentId?: string | null;
  loans?: { id: string; user: { id: string; name: string }; borrowedAt: string }[];
};
const statusClass: Record<string, string> = {
  Checked: "ok",
  Unchecked: "neutral",
  Missing: "bad",
  Damaged: "warn",
  Borrowed: "borrowed",
};
const labels: Record<Field, string> = {
  sku: "SKU",
  labelCode: "Label Code",
  poNumber: "PO No.",
  inventoryCode: "Inventory Code",
  productCode: "Product Code",
  serialNumber: "Serial No.",
  userLocation: "User/Location",
  name: "Product Description",
  description: "Description",
  category: "Category",
  quantity: "Quantity",
  unit: "Unit",
  location: "Location",
  status: "Status",
  remark: "Remark",
};
const blank = {
  sku: "",
  labelCode: "",
  poNumber: "",
  inventoryCode: "",
  productCode: "",
  serialNumber: "",
  userLocation: "",
  name: "",
  description: "",
  category: "未分類",
  quantity: 0,
  unit: "件",
  location: "未指定",
  minimumStock: 0,
  status: "Unchecked",
  remark: "",
};
async function json(url: string, options?: RequestInit) {
  const r = await fetch(url, options);
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "操作失敗");
  return d;
}
function fmt(v: string | null) {
  return v
    ? new Intl.DateTimeFormat("zh-HK", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(v))
    : "—";
}

export default function AppShell({ initialUser }: { initialUser: { id: string; name: string; email: string; role: string } }) {
  const [tab, setTab] = useState("dashboard"),
    [items, setItems] = useState<Item[]>([]),
    [stats, setStats] = useState<any>({}),
    [q, setQ] = useState(""),
    [status, setStatus] = useState(""),
    [category, setCategory] = useState(""),
    [location, setLocation] = useState(""),
    [loading, setLoading] = useState(true),
    [toast, setToast] = useState(""),
    [error, setError] = useState(""),
    [editing, setEditing] = useState<any>(null),
    [selected, setSelected] = useState<string[]>([]),
    [page, setPage] = useState(1),
    [inventoryTitle, setInventoryTitle] = useState("庫存管理"),
    [departments, setDepartments] = useState<any[]>([]),
    [departmentId, setDepartmentId] = useState(""),
    [departmentName, setDepartmentName] = useState(""),
    [menuOpen, setMenuOpen] = useState(false),
    [statusSaving, setStatusSaving] = useState(""),
    [transferDepartmentId, setTransferDepartmentId] = useState("");
  const loadDepartments = useCallback(async () => { const list = await json("/api/departments"); setDepartments(list); }, []);
  useEffect(() => { void loadDepartments(); }, [loadDepartments]);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ q, status, category, location, departmentId });
      const [list, s] = await Promise.all([
        json("/api/items?" + p),
        json("/api/dashboard?departmentId=" + encodeURIComponent(departmentId)),
      ]);
      setItems(list);
      setStats(s);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [q, status, category, location, departmentId]);
  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);
  useEffect(() => setPage(1), [q, status, category, location]);
  useEffect(() => {
    const savedTitle = window.localStorage.getItem("inventory-title")?.trim();
    if (savedTitle) setInventoryTitle(savedTitle);
  }, []);
  const changeInventoryTitle = (value: string) => {
    const nextTitle = value.slice(0, 40);
    setInventoryTitle(nextTitle);
    if (nextTitle.trim()) {
      window.localStorage.setItem("inventory-title", nextTitle.trim());
    } else {
      window.localStorage.removeItem("inventory-title");
    }
  };
  const notify = (s: string) => {
    setToast(s);
    setTimeout(() => setToast(""), 2600);
  };
  const createDepartment = async () => {
    if (!departmentName.trim()) return setError("請輸入部門／Inventory 名稱");
    try {
      const created = await json("/api/departments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: departmentName }) });
      setDepartmentName(""); await loadDepartments(); setDepartmentId(created.id); notify("Inventory 已建立");
    } catch (e) { setError(e instanceof Error ? e.message : "建立失敗"); }
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await json(editing.id ? "/api/items/" + editing.id : "/api/items", {
        method: editing.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editing, departmentId }),
      });
      setEditing(null);
      notify("Item 已儲存");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "儲存失敗");
    }
  };
  const qty = async (i: Item, delta: number) => {
    if (i.quantity + delta < 0) return setError("數量不可減至零以下");
    await json("/api/items/" + i.id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity: i.quantity + delta }),
    });
    load();
  };
  const changeStatus = async (item: Item, nextStatus: string) => {
    if (item.status === "Borrowed") return setError("借出中的 Item 請先在流動盤點頁掃描歸還");
    setStatusSaving(item.id);
    const previous = item.status;
    setItems(current => current.map(i => i.id === item.id ? { ...i, status: nextStatus } : i));
    try {
      await json("/api/items/" + item.id, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: nextStatus }) });
      notify(`Status 已更新為 ${nextStatus}`);
      await load();
    } catch (e) {
      setItems(current => current.map(i => i.id === item.id ? { ...i, status: previous } : i));
      setError(e instanceof Error ? e.message : "Status 更新失敗");
    } finally { setStatusSaving(""); }
  };
  const removeItem = async (id: string) => {
    if (!confirm("確定移除此 item？項目會從庫存列表隱藏，但變更紀錄仍會保留。")) return;
    await json("/api/items/" + id, { method: "DELETE" });
    load();
  };
  const bulk = async (action: string) => {
    if (!selected.length) return;
    if (!confirm("確定批量執行此操作？")) return;
    await json("/api/items/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: selected,
        ...(action === "archive" ? { archive: true } : { status: action }),
      }),
    });
    setSelected([]);
    load();
  };
  const transferSelected = async () => {
    if (!selected.length || !transferDepartmentId) return setError("請選擇 Item 及目標 Inventory／部門");
    const target = departments.find(d => d.id === transferDepartmentId);
    if (!confirm(`確定把 ${selected.length} 件 Item 轉移至「${target?.name || "目標部門"}」？`)) return;
    try {
      const result = await json("/api/items/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: selected, departmentId: transferDepartmentId }) });
      setSelected([]); setTransferDepartmentId(""); await Promise.all([load(), loadDepartments()]); notify(`已轉移 ${result.updatedCount} 件 Item${result.skippedCount ? `，跳過 ${result.skippedCount} 件` : ""}`);
    } catch (e) { setError(e instanceof Error ? e.message : "轉移失敗"); }
  };
  const cats = [...new Set(items.map((i) => i.category))],
    locs = [...new Set(items.map((i) => i.userLocation || i.location).filter(Boolean))],
    per = 8,
    pages = Math.max(1, Math.ceil(items.length / per)),
    shown = items.slice((page - 1) * per, page * per);
  return (
    <div className="app">
      <aside className={menuOpen ? "menu-open" : ""}>
        <div className="brand">
          <span>庫</span>
          <div>
            Stockroom<small>Inventory OS</small>
          </div>
        </div>
        <nav>
          {[
            ["dashboard", LayoutDashboard, "總覽 Dashboard"],
            ["inventory", Boxes, "庫存 Inventory"],
            ["import", FileSpreadsheet, "Excel 匯入"],
            ["check", Camera, "流動盤點"],
            ["sessions", ClipboardCheck, "盤點批次"],
            ["logs", History, "活動紀錄"],
            ["account", KeyRound, "修改密碼"],
            ...(initialUser.role === "ADMIN" ? [["users", UserPlus, "使用者帳戶"]] : []),
          ].map(([k, I, l]: any) => (
            <button
              className={tab === k ? "active" : ""}
              key={k}
              onClick={() => { setTab(k); setMenuOpen(false); }}
            >
              <I size={19} />
              {l}
            </button>
          ))}
        </nav>
        <div className="admin">
          <b>{initialUser.name.slice(0, 1).toUpperCase()}</b>
          <span>
            {initialUser.name}<small>{initialUser.role === "ADMIN" ? "系統管理員" : initialUser.email}</small>
          </span>
          <button title="登出" onClick={async () => { await json("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }}><LogOut size={17}/></button>
        </div>
      </aside>
      {menuOpen && <button className="menu-backdrop" aria-label="關閉選單" onClick={() => setMenuOpen(false)}/>}
      <main>
        <header>
          <button className="mobile-menu" aria-label="開啟選單" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
            <Menu />
          </button>
          <div>
            {tab === "inventory" ? (
              <label className="editable-title">
                <span className="sr-only">庫存頁面名稱</span>
                <input
                  aria-label="庫存頁面名稱"
                  maxLength={40}
                  onBlur={() => {
                    if (!inventoryTitle.trim()) setInventoryTitle("庫存管理");
                  }}
                  onChange={(event) => changeInventoryTitle(event.target.value)}
                  value={inventoryTitle}
                />
                <Pencil aria-hidden="true" size={17} />
              </label>
            ) : (
              <h1>
                {tab === "dashboard"
                  ? "庫存總覽"
                  : tab === "import"
                    ? "Excel 匯入"
                    : tab === "check"
                      ? "流動盤點"
                      : tab === "sessions"
                        ? "盤點批次"
                        : tab === "users"
                          ? "使用者帳戶"
                          : tab === "account"
                            ? "修改密碼"
                        : "活動紀錄"}
              </h1>
            )}
            <p>
              {new Intl.DateTimeFormat("zh-HK", { dateStyle: "full" }).format(
                new Date(),
              )}
            </p>
          </div>
          <a className="button secondary" href="/api/export">
            <Download size={17} />
            匯出 Excel
          </a>
        </header>
        <section className="inventory-switcher">
          <Building2 size={20}/>
          <label>Inventory／部門<select value={departmentId} onChange={e => setDepartmentId(e.target.value)}><option value="">全部 Inventory</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name} ({d._count?.items ?? 0})</option>)}</select></label>
          {initialUser.role === "ADMIN" && <><input value={departmentName} onChange={e => setDepartmentName(e.target.value)} onKeyDown={e => e.key === "Enter" && void createDepartment()} placeholder="新部門名稱"/><button className="button secondary" onClick={() => void createDepartment()}><Plus size={17}/>Create Inventory</button></>}
        </section>
        {error && (
          <div className="alert">
            {error}
            <button onClick={() => setError("")}>
              <X />
            </button>
          </div>
        )}
        {toast && <div className="toast">{toast}</div>}
        {tab === "dashboard" && (
          <Dashboard stats={stats} items={items} setTab={setTab} />
        )}
        {tab === "inventory" && (
          <section>
            <div className="toolbar">
              <label className="search">
                <Search />
                <input
                  aria-label="搜尋"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="搜尋 Inventory Code、Product Code、Serial No. 或描述…"
                />
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">所有狀態</option>
                {Object.keys(statusClass).map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">所有分類</option>
                {cats.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              >
                <option value="">所有位置</option>
                {locs.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
              <button className="button" onClick={() => setEditing(blank)}>
                <PackagePlus size={17} />
                新增
              </button>
            </div>
            {selected.length > 0 && (
              <div className="bulk">
                <strong>{selected.length} 項已選擇</strong>
                <div className="bulk-actions"><button onClick={() => bulk("Checked")}>標為 Checked</button><button onClick={() => bulk("Missing")}>標為 Missing</button><button onClick={() => bulk("archive")}>移除</button></div>
                <div className="bulk-transfer"><select aria-label="目標 Inventory／部門" value={transferDepartmentId} onChange={e => setTransferDepartmentId(e.target.value)}><option value="">轉移至 Inventory／部門…</option>{departments.filter(d => d.id !== departmentId).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select><button className="transfer-button" disabled={!transferDepartmentId} onClick={() => void transferSelected()}>確認轉移</button></div>
              </div>
            )}
            <div className="table-wrap inventory-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        checked={
                          shown.length > 0 &&
                          shown.every((i) => selected.includes(i.id))
                        }
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [
                                  ...new Set([
                                    ...selected,
                                    ...shown.map((i) => i.id),
                                  ]),
                                ]
                              : selected.filter(
                                  (x) => !shown.some((i) => i.id === x),
                                ),
                          )
                        }
                      />
                    </th>
                    <th>PO No.</th>
                    <th>Inventory Code</th>
                    <th>Product Code</th>
                    <th>Product Description</th>
                    <th>Qty</th>
                    <th>Serial No.</th>
                    <th>User/Location</th>
                    <th>Latest Review Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={11}>載入中…</td>
                    </tr>
                  ) : shown.length ? (
                    shown.map((i) => (
                      <tr key={i.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selected.includes(i.id)}
                            onChange={(e) =>
                              setSelected(
                                e.target.checked
                                  ? [...selected, i.id]
                                  : selected.filter((x) => x !== i.id),
                              )
                            }
                          />
                        </td>
                        <td>{i.poNumber || "—"}</td>
                        <td><b>{i.inventoryCode || i.sku || "—"}</b></td>
                        <td>{i.productCode || "—"}</td>
                        <td><b>{i.name}</b></td>
                        <td>
                          <div className="stepper">
                            <button onClick={() => qty(i, -1)}>
                              <Minus />
                            </button>
                            <b>{i.quantity}</b>
                            <button onClick={() => qty(i, 1)}>
                              <Plus />
                            </button>
                          </div>
                        </td>
                        <td>{i.serialNumber || "—"}</td>
                        <td>{i.userLocation || i.location || "—"}</td>
                        <td className="review-date">{fmt(i.lastCheckedAt)}</td>
                        <td>
                          <select aria-label={`更改 ${i.name} Status`} className={`status-select ${statusClass[i.status] || "neutral"}`} disabled={statusSaving === i.id || i.status === "Borrowed"} value={i.status} onChange={e => void changeStatus(i, e.target.value)} title={i.status === "Borrowed" ? "請掃描歸還後再更改 Status" : "直接更改 Status"}>
                            {i.status === "Borrowed" && <option value="Borrowed">Borrowed</option>}
                            <option value="Checked">Checked</option><option value="Unchecked">Unchecked</option><option value="Missing">Missing</option><option value="Damaged">Damaged</option>
                          </select>
                        </td>
                        <td>
                          <div className="actions">
                            <button onClick={() => setEditing(i)}>編輯</button>
                            <button title="移除 item" aria-label={"移除 " + i.name} onClick={() => removeItem(i.id)}>
                              <Trash2 />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={11}>沒有符合條件的庫存</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>共 {items.length} 項</span>
              <button disabled={page === 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft />
              </button>
              <b>
                {page} / {pages}
              </b>
              <button
                disabled={page === pages}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight />
              </button>
            </div>
          </section>
        )}
        {tab === "import" && (
          <ImportPanel departmentId={departmentId}
            onDone={() => {
              load();
              notify("匯入完成");
            }}
          />
        )}
        {tab === "check" && (
          <CheckPanel items={items} notify={notify} reload={load} currentUser={initialUser} />
        )}{" "}
        {tab === "sessions" && <SessionsPanel items={items} notify={notify} />}{" "}
        {tab === "logs" && <LogsPanel />}
        {tab === "users" && <UsersPanel departments={departments} notify={notify}/>}
        {tab === "account" && <AccountPanel notify={notify}/>}
        {editing && (
          <div className="modal">
            <form className="dialog" onSubmit={save}>
              <div className="dialog-head">
                <h2>{editing.id ? "編輯 Item" : "新增 Item"}</h2>
                <button type="button" onClick={() => setEditing(null)}>
                  <X />
                </button>
              </div>
              <div className="formgrid">
                {Object.entries(labels).map(([k, l]) => (
                  <label
                    key={k}
                    className={
                      k === "description" || k === "remark" ? "wide" : ""
                    }
                  >
                    {l}
                    {k === "status" ? (
                      <select
                        value={editing[k] ?? ""}
                        onChange={(e) =>
                          setEditing({ ...editing, [k]: e.target.value })
                        }
                      >
                        {Object.keys(statusClass).map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        required={k === "name"}
                        type={
                          k === "quantity" || k === "minimumStock"
                            ? "number"
                            : "text"
                        }
                        min={
                          k === "quantity" || k === "minimumStock"
                            ? 0
                            : undefined
                        }
                        value={editing[k] ?? ""}
                        onChange={(e) =>
                          setEditing({ ...editing, [k]: e.target.value })
                        }
                      />
                    )}
                  </label>
                ))}
              </div>
              <div className="dialog-actions">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setEditing(null)}
                >
                  取消
                </button>
                <button className="button">儲存</button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
function Dashboard({ stats, items, setTab }: any) {
  return (
    <>
      <div className="hero">
        <button className="button light" onClick={() => setTab("check")}>
          <Camera />
          開始掃描盤點
        </button>
      </div>
      <div className="cards">
        {[
          ["庫存品項", stats.totalItems, Boxes],
          ["總數量", stats.totalQuantity, PackagePlus],
          ["已盤點", stats.checked, ClipboardCheck],
          ["未盤點", stats.unchecked, History],
        ].map(([l, v, I]: any) => (
          <div className="metric" key={l}>
            <I />
            <small>{l}</small>
            <b>{v || 0}</b>
          </div>
        ))}
      </div>
      <div className="dashgrid">
        <section>
          <div className="section-head">
            <h3>需留意項目</h3>
            <button onClick={() => setTab("inventory")}>查看全部 →</button>
          </div>
          {items
            .filter((i: Item) => ["Missing", "Damaged"].includes(i.status))
            .slice(0, 5)
            .map((i: Item) => (
              <div className="watch" key={i.id}>
                <div>
                  <b>{i.name}</b>
                  <small>
                    {i.sku} · {i.location}
                  </small>
                </div>
                <strong>
                  {i.quantity} {i.unit}
                </strong>
                <span className={"badge " + statusClass[i.status]}>
                  {i.status}
                </span>
              </div>
            ))}
        </section>
        <section>
          <h3>最近活動</h3>
          {(stats.recent || []).map((a: any) => (
            <div className="activity" key={a.id}>
              <b>{a.action}</b>
              <span>{a.item.name}</span>
              <small>{fmt(a.createdAt)}</small>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}

function ImportPanel({ onDone, departmentId }: { onDone: () => void; departmentId: string }) {
  const [file, setFile] = useState<File | null>(null),
    [sheets, setSheets] = useState<string[]>([]),
    [sheet, setSheet] = useState(""),
    [rows, setRows] = useState<Record<string, unknown>[]>([]),
    [mapping, setMapping] = useState<Partial<Record<Field, string>>>({}),
    [errors, setErrors] = useState<{ row: number; message: string }[]>([]),
    [result, setResult] = useState<any>(null),
    [busy, setBusy] = useState(false);
  const read = async (f: File) => {
    if (f.size > 10 * 1024 * 1024) throw new Error("檔案不可超過 10MB");
    const wb = XLSX.read(await f.arrayBuffer(), {
      type: "array",
      cellDates: true,
    });
    (window as any).__wb = wb;
    setFile(f);
    setSheets(wb.SheetNames);
    choose(wb.SheetNames[0], wb);
  };
  const choose = (name: string, book?: XLSX.WorkBook) => {
    const wb = book || (window as any).__wb;
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      wb.Sheets[name],
      { defval: "" },
    );
    setSheet(name);
    setRows(data);
    setMapping(autoMap(Object.keys(data[0] || {})));
    setErrors([]);
    setResult(null);
  };
  const validation = useMemo(() => parseRows(rows, mapping), [rows, mapping]);
  const headers = Object.keys(rows[0] || {});
  const commit = async () => {
    setBusy(true);
    try {
      const r = await json("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file?.name, rows: validation.valid, departmentId: departmentId || null }),
      });
      setResult(r);
      onDone();
    } catch (e) {
      setErrors([
        { row: 0, message: e instanceof Error ? e.message : "匯入失敗" },
      ]);
    } finally {
      setBusy(false);
    }
  };
  const report = () => {
    const ws = XLSX.utils.json_to_sheet([
      ...validation.errors,
      ...(result?.errors || []),
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Errors");
    XLSX.writeFile(wb, "inventory-import-errors.xlsx");
  };
  return (
    <section className="panel import">
      <div className="section-head">
        <div>
          <h2>Excel 匯入精靈</h2>
          <p>支援 .xlsx、.xls、.csv；最多 10MB／10,000 列。</p>
        </div>
        <a className="button secondary" href="/templates/inventory-import-template.xlsx" download>
          <Download size={17} />
          下載空白範本
        </a>
      </div>
      <label
        className="drop"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) read(f);
        }}
      >
        <Upload />
        <b>{file ? file.name : "拖放 Excel 到這裡"}</b>
        <span>或點擊選擇檔案</span>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) read(f);
          }}
        />
      </label>
      {file && (
        <>
          <div className="import-controls">
            <label>
              Sheet
              <select value={sheet} onChange={(e) => choose(e.target.value)}>
                {sheets.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <div>
              <b>{validation.valid.length}</b> 可匯入 ·{" "}
              <b>{validation.errors.length}</b> 錯誤
            </div>
          </div>
          <h3>欄位 Mapping</h3>
          <div className="mapping">
            {fields.map((f) => (
              <label key={f}>
                {labels[f]}
                {(f === "name" || f === "inventoryCode" || f === "sku" || f === "labelCode") && (
                  <small>重要</small>
                )}
                <select
                  value={mapping[f] || ""}
                  onChange={(e) =>
                    setMapping({ ...mapping, [f]: e.target.value })
                  }
                >
                  <option value="">不匯入</option>
                  {headers.map((h) => (
                    <option key={h}>{h}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <h3>首 20 行預覽</h3>
          <div className="table-wrap preview">
            <table>
              <thead>
                <tr>
                  {headers.map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 20).map((r, n) => (
                  <tr key={n}>
                    {headers.map((h) => (
                      <td key={h}>{String(r[h] ?? "")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {validation.errors.length > 0 && (
            <div className="validation">
              <b>需要修正</b>
              {validation.errors.slice(0, 8).map((e) => (
                <p key={e.row}>
                  第 {e.row} 行：{e.message}
                </p>
              ))}
            </div>
          )}
          <div className="dialog-actions">
            {(validation.errors.length > 0 || result?.errors?.length > 0) && (
              <button className="button secondary" onClick={report}>
                下載錯誤報告
              </button>
            )}
            <button
              className="button"
              disabled={!validation.valid.length || busy}
              onClick={commit}
            >
              {busy ? "匯入中…" : `確認匯入 ${validation.valid.length} 行`}
            </button>
          </div>
          {result && (
            <div className="success">
              完成：新增 {result.inserted}、更新 {result.updated}、跳過{" "}
              {result.skipped}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function CheckPanel({
  items,
  notify,
  reload,
  currentUser,
}: {
  items: Item[];
  notify: (s: string) => void;
  reload: () => void;
  currentUser: { id: string; name: string };
}) {
  const [value, setValue] = useState(""),
    [matches, setMatches] = useState<any[]>([]),
    [resultOpen, setResultOpen] = useState(false),
    [method, setMethod] = useState("Manual"),
    [busy, setBusy] = useState(false),
    [camera, setCamera] = useState(false),
    [cameraReady, setCameraReady] = useState(false),
    [ocrProgress, setOcrProgress] = useState(""),
    video = useRef<HTMLVideoElement>(null),
    streamRef = useRef<MediaStream | null>(null),
    last = useRef("");
  useEffect(() => {
    if (!camera || !video.current || !streamRef.current) return;
    const player = video.current;
    player.srcObject = streamRef.current;
    const play = () => {
      player.play().catch(() => setCameraReady(false));
    };
    player.addEventListener("loadedmetadata", play);
    play();
    return () => player.removeEventListener("loadedmetadata", play);
  }, [camera]);
  useEffect(() => {
    return () => streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);
  const search = async (v = value, m = method) => {
    if (!v.trim()) return;
    setBusy(true);
    try {
      const r = await json("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: v, method: m }),
      });
      setMatches(r.matches);
      setResultOpen(["OCR", "Barcode", "QR"].includes(m));
    } finally {
      setBusy(false);
    }
  };
  const confirmItem = async (m: any) => {
    const key = m.item.id + value;
    if (last.current === key) return;
    last.current = key;
    try {
      await json("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          value,
          method,
          confidence: m.confidence,
          itemId: m.item.id,
        }),
      });
      notify(`${m.item.name} 已於 ${new Date().toLocaleTimeString()} 完成盤點`);
      setValue("");
      setMatches([]);
      setResultOpen(false);
      reload();
      setTimeout(() => (last.current = ""), 2500);
    } catch (e) {
      last.current = "";
      throw e;
    }
  };
  const loanItem = async (m: any) => {
    const active = m.item.loans?.[0];
    const action = active ? "return" : "borrow";
    const key = `${action}:${m.item.id}:${value}`;
    if (last.current === key) return;
    last.current = key;
    try {
      await json("/api/loans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: m.item.id, action, detectedValue: value, detectionMethod: method }) });
      notify(`${m.item.name} 已${active ? "歸還" : `借出給 ${currentUser.name}`}`);
      setValue(""); setMatches([]); setResultOpen(false); reload(); setTimeout(() => (last.current = ""), 2500);
    } catch (e) { last.current = ""; notify(e instanceof Error ? e.message : "借還操作失敗"); }
  };
  const start = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("此瀏覽器不支援相機存取");
      streamRef.current?.getTracks().forEach((track) => track.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      const track = stream.getVideoTracks()[0];
      const capabilities = (track?.getCapabilities?.() || {}) as any;
      if (capabilities.focusMode?.includes?.("continuous")) await track.applyConstraints({ advanced: [{ focusMode: "continuous" } as any] });
      streamRef.current = stream;
      setCameraReady(false);
      setCamera(true);
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      notify(
        name === "NotAllowedError"
          ? "相機權限被拒絕，請在瀏覽器網站設定允許 Camera 後重新整理"
          : name === "NotFoundError"
            ? "找不到可用鏡頭，請改用上載 Label 相片"
            : error instanceof Error
              ? error.message
              : "無法開啟相機，請改用圖片／手動輸入",
      );
    }
  };
  const runOcr = async (source: File | Blob) => {
    setOcrProgress("正在強化影像…");
    const prepared = await prepareOcrImages(source);
    if (prepared.brightness < 45) notify("影像較暗，正在使用高對比模式；建議增加光線");
    else if (prepared.contrast < 22) notify("Label 對比較低，正在加強文字邊界");
    const T = await import("tesseract.js");
    const worker = await T.createWorker("eng");
    await worker.setParameters({ tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_- ", preserve_interword_spaces: "1" });
    let best: { value: string; matches: any[]; score: number } | null = null;
    try {
      for (let index=0; index<prepared.images.length; index++) {
        setOcrProgress(`OCR 辨認 ${index+1}/${prepared.images.length}…`);
        const result = await worker.recognize(prepared.images[index]);
        const candidates = extractLabelCandidates(result.data.text).slice(0, 6);
        for (const candidate of candidates) {
          const response = await json("/api/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value: candidate, method: "OCR" }) });
          const score = (response.matches[0]?.confidence || 0) * 100 + Math.max(0, result.data.confidence) / 100;
          if (!best || score > best.score) best = { value: candidate, matches: response.matches, score };
        }
        if (best?.matches[0]?.confidence === 1) break;
      }
    } finally { await worker.terminate(); setOcrProgress(""); }
    if (!best) { notify("未能辨認 Label 號碼。請保持鏡頭平穩、增加光線並讓號碼填滿框內"); return; }
    setValue(best.value); setMethod("OCR"); setMatches(best.matches); setResultOpen(true);
  };
  const detectBarcode = async (source: ImageBitmapSource) => {
    const Detector = (window as any).BarcodeDetector;
    if (!Detector) return null;
    const wanted = ["qr_code","data_matrix","pdf417","code_128","code_39","code_93","codabar","itf","ean_13","ean_8","upc_a","upc_e"];
    const supported = Detector.getSupportedFormats ? await Detector.getSupportedFormats() : wanted;
    const formats = wanted.filter(format => supported.includes(format));
    if (!formats.length) return null;
    const codes = await new Detector({ formats }).detect(source);
    return codes[0] || null;
  };
  const scanFrame = async () => {
    if (!video.current) return;
    setBusy(true);
    try {
      const code = await detectBarcode(video.current);
        if (code) {
          const detectionMethod = code.format === "qr_code" ? "QR" : "Barcode";
          setValue(code.rawValue);
          setMethod(detectionMethod);
          await search(code.rawValue, detectionMethod);
          return;
        }
      const canvas = document.createElement("canvas");
      canvas.width = video.current.videoWidth;
      canvas.height = video.current.videoHeight;
      const context = canvas.getContext("2d");
      if (!context || !canvas.width || !canvas.height) throw new Error("相機畫面尚未準備好");
      context.drawImage(video.current, 0, 0, canvas.width, canvas.height);
      const frame = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.95));
      if (frame) await runOcr(frame);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Label 辨認失敗");
    } finally {
      setBusy(false);
    }
  };
  const image = async (file: File) => {
    setBusy(true);
    try {
      const bitmap = await createImageBitmap(file);
      const code = await detectBarcode(bitmap);
      bitmap.close();
        if (code) {
          const detectionMethod = code.format === "qr_code" ? "QR" : "Barcode";
          setValue(code.rawValue);
          setMethod(detectionMethod);
          await search(code.rawValue, detectionMethod);
          return;
        }
      await runOcr(file);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="check-layout">
      <div className="scanner">
        <div className="section-head">
          <div>
            <small>MOBILE INVENTORY CHECK</small>
            <h2>掃描貨品標籤</h2>
          </div>
        </div>
        {camera ? (
          <div className="camera">
            <video
              ref={video}
              autoPlay
              muted
              playsInline
              onPlaying={() => setCameraReady(true)}
            />
            {!cameraReady && (
              <span className="camera-loading" role="status">正在開啟鏡頭…</span>
            )}
            <div className="scanline" />
            <button className="button light" disabled={!cameraReady || busy} onClick={scanFrame}>
              {busy ? ocrProgress || "辨認中…" : "擷取並辨認"}
            </button>
          </div>
        ) : (
          <button className="camera-placeholder" onClick={start}>
            <Camera />
            <b>啟動後置鏡頭</b>
            <span>需要相機權限；localhost 或 HTTPS</span>
          </button>
        )}
        <div className="or">或</div>
        <label className="button secondary upload-label">
          <Upload />
          上載 Label 相片
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) image(f);
            }}
          />
        </label>
        <div className="manual">
          <input
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setMethod("Manual");
            }}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="輸入 Inventory Code、Product Code、Serial No. 或描述"
          />
          <button className="button" disabled={busy} onClick={() => search()}>
            <Search />
            搜尋
          </button>
        </div>
      </div>
      <div className="candidates">
        <h3>辨認結果</h3>
        {!matches.length ? (
          <div className="empty">
            尚未有結果。完全匹配才可快速確認；較低信心結果需人工選擇。
          </div>
        ) : (
          matches.map((m) => (
            <button
              className="candidate"
              key={m.item.id}
              onClick={() => loanItem(m)}
            >
              <div>
                <b>{m.item.name}</b>
                <small>
                  {m.item.inventoryCode || m.item.sku || "—"} · {m.item.productCode || m.item.labelCode || "—"} · {m.item.serialNumber || "無序號"}
                </small>
              </div>
              <strong>{Math.round(m.confidence * 100)}%</strong>
              <span>{m.item.loans?.[0] ? "歸還" : "借出"}</span>
            </button>
          ))
        )}
      </div>
      {resultOpen && (
        <div className="modal scan-result-modal" role="dialog" aria-modal="true" aria-labelledby="scan-result-title">
          <div className="dialog scan-result-dialog">
            <div className="dialog-head">
              <div>
                <small>辨認號碼</small>
                <h2 id="scan-result-title">{value}</h2>
              </div>
              <button type="button" aria-label="關閉辨認結果" onClick={() => setResultOpen(false)}><X /></button>
            </div>
            {!matches.length ? (
              <div className="empty scan-result-empty">找不到相符 inventory。請關閉後重新擷取，或使用手動搜尋。</div>
            ) : (
              <div className="scan-result-list">
                {matches.map((match) => (
                  <article className="scan-result-card" key={match.item.id}>
                    <div>
                      <b>{match.item.name}</b>
                      <small>{match.item.inventoryCode || match.item.sku || "—"} · {match.item.productCode || match.item.labelCode || "—"}</small>
                    </div>
                    <strong>{Math.round(match.confidence * 100)}% 匹配</strong>
                    {match.item.loans?.[0] && <p className="loan-note">目前借用者：{match.item.loans[0].user.name}</p>}
                    <button type="button" className={`button confirm-check-button ${match.item.loans?.[0] ? "return-button" : "borrow-button"}`} onClick={() => void loanItem(match)}>
                      <ClipboardCheck size={24}/>{match.item.loans?.[0] ? "確認歸還" : "確認借出"}
                    </button>
                    <button type="button" className="button secondary" onClick={() => void confirmItem(match)}>只作盤點</button>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function SessionsPanel({
  items,
  notify,
}: {
  items: Item[];
  notify: (s: string) => void;
}) {
  const [sessions, setSessions] = useState<any[]>([]),
    [name, setName] = useState(""),
    [loc, setLoc] = useState(""),
    [cat, setCat] = useState("");
  const load = () => json("/api/sessions").then(setSessions);
  useEffect(() => {
    void load();
  }, []);
  const create = async () => {
    if (!name.trim()) {
      notify("請先輸入 Session Name");
      return;
    }
    try {
      await json("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), locationFilter: loc, categoryFilter: cat }),
      });
      setName("");
      notify("盤點批次已建立");
      await load();
    } catch (error) {
      notify(error instanceof Error ? error.message : "建立盤點批次失敗");
    }
  };
  const end = async (s: any) => {
    if (!confirm("結束盤點？可選擇把未盤點貨品標示為 Missing。")) return;
    const markMissing = confirm("是否將未盤點 item 批量標示為 Missing？");
    await json("/api/sessions/" + s.id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markMissing }),
    });
    load();
  };
  const locs = [...new Set(items.map((i) => i.userLocation || i.location).filter(Boolean))],
    cats = [...new Set(items.map((i) => i.category))];
  return (
    <section>
      <div className="session-create">
        <div>
          <small>NEW CHECK SESSION</small>
          <h2>建立盤點批次</h2>
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如：九月 A 倉盤點"
          aria-label="Session Name"
          required
          onKeyDown={(event) => {
            if (event.key === "Enter") void create();
          }}
        />
        <select value={loc} onChange={(e) => setLoc(e.target.value)}>
          <option value="">所有位置</option>
          {locs.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">所有分類</option>
          {cats.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <button className="button" onClick={() => void create()}>
          建立 Session
        </button>
      </div>
      {!items.length && (
        <div className="validation" role="status">目前沒有庫存項目。可先建立批次，但 Expected 會是 0；請先到 Excel 匯入加入 inventory。</div>
      )}
      <div className="session-grid">
        {sessions.map((s) => (
          <div className="session-card" key={s.id}>
            <div className="section-head">
              <div>
                <span
                  className={
                    "badge " + (s.status === "ACTIVE" ? "ok" : "neutral")
                  }
                >
                  {s.status}
                </span>
                <h3>{s.name}</h3>
                <small>
                  {s.locationFilter || "所有位置"} ·{" "}
                  {s.categoryFilter || "所有分類"}
                </small>
              </div>
              <b>
                {s.stats.checked}/{s.stats.expected}
              </b>
            </div>
            <div className="progress">
              <i
                style={{
                  width:
                    (s.stats.expected
                      ? (s.stats.checked / s.stats.expected) * 100
                      : 0) + "%",
                }}
              />
            </div>
            <div className="session-stats">
              <span>
                Expected <b>{s.stats.expected}</b>
              </span>
              <span>
                Checked <b>{s.stats.checked}</b>
              </span>
              <span>
                Unchecked <b>{s.stats.unchecked}</b>
              </span>
              <span>
                Missing <b>{s.stats.missing}</b>
              </span>
            </div>
            {s.status === "ACTIVE" && (
              <button className="button secondary" onClick={() => end(s)}>
                結束盤點
              </button>
            )}
            <a href={"/api/export?sessionId=" + s.id}>匯出此 Session</a>
          </div>
        ))}
      </div>
    </section>
  );
}

function LogsPanel() {
  const [data, setData] = useState<any>({
    audits: [],
    checks: [],
    imports: [],
    loans: [],
  });
  useEffect(() => {
    json("/api/logs").then(setData);
  }, []);
  return (
    <section className="logs">
      <h2>不可覆蓋的操作紀錄</h2>
      <div className="dashgrid">
        <div>
          <h3>Audit Log</h3>
          {data.audits.map((a: any) => (
            <div className="logrow" key={a.id}>
              <span className="badge neutral">{a.source}</span>
              <div>
                <b>
                  {a.action} · {a.item.name}
                </b>
                <small>{a.item.sku} · Admin</small>
              </div>
              <time>{fmt(a.createdAt)}</time>
            </div>
          ))}
        </div>
        <div>
          <h3>Check Log</h3>
          {data.checks.map((a: any) => (
            <div className="logrow" key={a.id}>
              <span className="badge ok">{a.detectionMethod}</span>
              <div>
                <b>{a.item.name}</b>
                <small>
                  {a.session?.name || "快速盤點"} ·{" "}
                  {Math.round(a.confidence * 100)}%
                </small>
              </div>
              <time>{fmt(a.checkedAt)}</time>
            </div>
          ))}
        </div>
      </div>
      <h3>借出／歸還紀錄 Loan Log</h3>
      {data.loans.map((x: any) => <div className="import-job" key={x.id}><b>{x.returnedAt ? "已歸還" : "借出中"} · {x.item.name}</b><span>{x.item.inventoryCode || x.item.sku || "—"} · 借用者 {x.user.name} · {x.detectionMethod}</span><time>借出 {fmt(x.borrowedAt)}{x.returnedAt ? ` · 歸還 ${fmt(x.returnedAt)}` : ""}</time></div>)}
      <h3>Excel 匯入紀錄</h3>
      {data.imports.map((x: any) => (
        <div className="import-job" key={x.id}>
          <b>{x.fileName}</b>
          <span>
            新增 {x.insertedCount} · 更新 {x.updatedCount} · 跳過{" "}
            {x.skippedCount} · 錯誤 {x.errorCount}
          </span>
          <time>{fmt(x.createdAt)}</time>
        </div>
      ))}
    </section>
  );
}

function UsersPanel({ departments, notify }: { departments: any[]; notify: (s:string)=>void }) {
  const [data,setData]=useState<any>({users:[],resets:[]}),[form,setForm]=useState({name:"",email:"",password:"",role:"USER",departmentId:""}),[error,setError]=useState("");
  const loadUsers=()=>json("/api/users").then(setData).catch(e=>setError(e.message));
  useEffect(()=>{void loadUsers()},[]);
  const create=async(e:React.FormEvent)=>{e.preventDefault();setError("");try{await json("/api/users",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});setForm({name:"",email:"",password:"",role:"USER",departmentId:""});notify("使用者帳戶已建立");await loadUsers()}catch(e){setError(e instanceof Error?e.message:"建立失敗")}};
  const update=async(id:string,body:object,message:string)=>{try{await json(`/api/users/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});notify(message);await loadUsers()}catch(e){setError(e instanceof Error?e.message:"操作失敗")}};
  const reset=(id:string)=>{const password=prompt("輸入至少 8 位的臨時密碼：");if(password)void update(id,{resetPassword:password},"密碼已重設，所有舊 session 已登出")};
  const remove=async(id:string)=>{if(!confirm("確定刪除此帳戶？帳戶會被停用及匿名化，歷史借還紀錄仍會保留。"))return;try{await json(`/api/users/${id}`,{method:"DELETE"});notify("帳戶已刪除");await loadUsers()}catch(e){setError(e instanceof Error?e.message:"刪除失敗")}};
  return <section>{data.resets.length>0&&<div className="reset-requests"><h2>待處理密碼重設</h2>{data.resets.map((r:any)=><div key={r.id}><span><b>{r.user.name}</b> · {r.user.email}<small>{fmt(r.requestedAt)}</small></span><button className="button" onClick={()=>reset(r.user.id)}>設定臨時密碼</button></div>)}</div>}<form className="user-create" onSubmit={create}><h2>建立使用者帳戶</h2><input required placeholder="姓名" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/><input required type="email" placeholder="電郵" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/><input required minLength={8} type="password" placeholder="密碼（至少 8 位）" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/><select value={form.departmentId} onChange={e=>setForm({...form,departmentId:e.target.value})}><option value="">未指定部門</option>{departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select><select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}><option value="USER">一般使用者</option><option value="ADMIN">管理員</option></select><button className="button"><UserPlus size={17}/>建立帳戶</button>{error&&<div className="alert">{error}</div>}</form><div className="table-wrap"><table><thead><tr><th>姓名</th><th>電郵</th><th>角色</th><th>部門</th><th>狀態</th><th>操作</th></tr></thead><tbody>{data.users.map((u:any)=><tr key={u.id}><td><b>{u.name}</b></td><td>{u.email}</td><td>{u.role}</td><td>{u.department?.name||"—"}</td><td><span className={`badge ${u.active?"ok":"bad"}`}>{u.active?"使用中":"已停用"}</span></td><td><div className="actions"><button onClick={()=>void update(u.id,{active:!u.active},u.active?"帳戶已停用":"帳戶已重新啟用")}>{u.active?"停用":"啟用"}</button><button onClick={()=>reset(u.id)}>重設密碼</button><button className="danger-text" onClick={()=>void remove(u.id)}>刪除</button></div></td></tr>)}</tbody></table></div></section>
}

function AccountPanel({notify}:{notify:(s:string)=>void}){
  const [currentPassword,setCurrent]=useState(""),[newPassword,setNew]=useState(""),[confirmPassword,setConfirm]=useState(""),[error,setError]=useState("");
  const submit=async(e:React.FormEvent)=>{e.preventDefault();if(newPassword!==confirmPassword)return setError("兩次輸入的新密碼不相同");try{await json("/api/auth/change-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({currentPassword,newPassword})});setCurrent("");setNew("");setConfirm("");setError("");notify("密碼已更新，其他裝置已登出")}catch(e){setError(e instanceof Error?e.message:"修改失敗")}};
  return <section><form className="password-form" onSubmit={submit}><h2>修改密碼</h2><p>修改後，其他瀏覽器及裝置上的登入 session 會立即失效。</p><label>目前密碼<input required type="password" autoComplete="current-password" value={currentPassword} onChange={e=>setCurrent(e.target.value)}/></label><label>新密碼<input required minLength={8} type="password" autoComplete="new-password" value={newPassword} onChange={e=>setNew(e.target.value)}/></label><label>再次輸入新密碼<input required minLength={8} type="password" autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirm(e.target.value)}/></label>{error&&<div className="alert">{error}</div>}<button className="button"><KeyRound size={17}/>更新密碼</button></form></section>
}
