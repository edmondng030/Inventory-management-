"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  Boxes,
  Camera,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  History,
  LayoutDashboard,
  Menu,
  Minus,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  Upload,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import { autoMap, fields, parseRows, type Field } from "@/lib/excel";

type Item = {
  id: string;
  sku: string | null;
  labelCode: string | null;
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
};
const statusClass: Record<string, string> = {
  Checked: "ok",
  Unchecked: "neutral",
  Missing: "bad",
  Damaged: "warn",
  "Low Stock": "low",
};
const labels: Record<Field, string> = {
  sku: "SKU",
  labelCode: "Label Code",
  name: "Item Name",
  description: "Description",
  category: "Category",
  quantity: "Quantity",
  unit: "Unit",
  location: "Location",
  minimumStock: "Minimum Stock",
  status: "Status",
  remark: "Remark",
};
const blank = {
  sku: "",
  labelCode: "",
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

export default function AppShell() {
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
    [inventoryTitle, setInventoryTitle] = useState("庫存管理");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ q, status, category, location });
      const [list, s] = await Promise.all([
        json("/api/items?" + p),
        json("/api/dashboard"),
      ]);
      setItems(list);
      setStats(s);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [q, status, category, location]);
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
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await json(editing.id ? "/api/items/" + editing.id : "/api/items", {
        method: editing.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
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
  const archive = async (id: string) => {
    if (!confirm("確定封存此 item？")) return;
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
  const cats = [...new Set(items.map((i) => i.category))],
    locs = [...new Set(items.map((i) => i.location))],
    per = 8,
    pages = Math.max(1, Math.ceil(items.length / per)),
    shown = items.slice((page - 1) * per, page * per);
  return (
    <div className="app">
      <aside>
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
          ].map(([k, I, l]: any) => (
            <button
              className={tab === k ? "active" : ""}
              key={k}
              onClick={() => setTab(k)}
            >
              <I size={19} />
              {l}
            </button>
          ))}
        </nav>
        <div className="admin">
          <b>A</b>
          <span>
            Admin<small>本機管理員</small>
          </span>
        </div>
      </aside>
      <main>
        <header>
          <button className="mobile-menu">
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
                  placeholder="搜尋 SKU、標籤或品名…"
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
                {selected.length} 項已選擇{" "}
                <button onClick={() => bulk("Checked")}>標為 Checked</button>
                <button onClick={() => bulk("Missing")}>標為 Missing</button>
                <button onClick={() => bulk("archive")}>封存</button>
              </div>
            )}
            <div className="table-wrap">
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
                    <th>SKU / Label</th>
                    <th>Item</th>
                    <th>Category</th>
                    <th>Quantity</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Remark</th>
                    <th>Last checked</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={10}>載入中…</td>
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
                        <td>
                          <b>{i.sku || "—"}</b>
                          <small>{i.labelCode || "無標籤"}</small>
                        </td>
                        <td>
                          <b>{i.name}</b>
                          <small>{i.description}</small>
                        </td>
                        <td>{i.category}</td>
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
                          <small>
                            {i.unit} · min {i.minimumStock}
                          </small>
                        </td>
                        <td>{i.location}</td>
                        <td>
                          <span
                            className={
                              "badge " +
                              statusClass[
                                i.quantity <= i.minimumStock &&
                                !["Missing", "Damaged"].includes(i.status)
                                  ? "Low Stock"
                                  : i.status
                              ]
                            }
                          >
                            {i.quantity <= i.minimumStock &&
                            !["Missing", "Damaged"].includes(i.status)
                              ? "Low Stock"
                              : i.status}
                          </span>
                        </td>
                        <td>{i.remark || "—"}</td>
                        <td>{fmt(i.lastCheckedAt)}</td>
                        <td>
                          <div className="actions">
                            <button onClick={() => setEditing(i)}>編輯</button>
                            <button title="封存" onClick={() => archive(i.id)}>
                              <Archive />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={10}>沒有符合條件的庫存</td>
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
          <ImportPanel
            onDone={() => {
              load();
              notify("匯入完成");
            }}
          />
        )}
        {tab === "check" && (
          <CheckPanel items={items} notify={notify} reload={load} />
        )}{" "}
        {tab === "sessions" && <SessionsPanel items={items} notify={notify} />}{" "}
        {tab === "logs" && <LogsPanel />}
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
        <div>
          <small>INVENTORY HEALTH</small>
          <h2>倉庫狀態，一眼掌握。</h2>
          <p>
            今日共有 {stats.checked || 0} 件完成盤點，{stats.low || 0}{" "}
            件需要補貨。
          </p>
        </div>
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
          ["低庫存", stats.low, Archive],
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
            <h3>需留意庫存</h3>
            <button onClick={() => setTab("inventory")}>查看全部 →</button>
          </div>
          {items
            .filter(
              (i: Item) =>
                i.quantity <= i.minimumStock || i.status === "Missing",
            )
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

function ImportPanel({ onDone }: { onDone: () => void }) {
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
        body: JSON.stringify({ fileName: file?.name, rows: validation.valid }),
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
                {(f === "name" || f === "sku" || f === "labelCode") && (
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
}: {
  items: Item[];
  notify: (s: string) => void;
  reload: () => void;
}) {
  const [value, setValue] = useState(""),
    [matches, setMatches] = useState<any[]>([]),
    [method, setMethod] = useState("Manual"),
    [busy, setBusy] = useState(false),
    [camera, setCamera] = useState(false),
    video = useRef<HTMLVideoElement>(null),
    last = useRef("");
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
      reload();
      setTimeout(() => (last.current = ""), 2500);
    } catch (e) {
      last.current = "";
      throw e;
    }
  };
  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });
      setCamera(true);
      setTimeout(() => {
        if (video.current) {
          video.current.srcObject = stream;
          video.current.play();
        }
      }, 0);
    } catch {
      notify("無法開啟相機，請檢查權限或使用圖片／手動輸入");
    }
  };
  const scanFrame = async () => {
    const Detector = (window as any).BarcodeDetector;
    if (!Detector || !video.current)
      return notify("瀏覽器不支援 BarcodeDetector，請上載圖片或手動輸入");
    const d = new Detector({
      formats: ["qr_code", "code_128", "ean_13", "ean_8"],
    });
    const codes = await d.detect(video.current);
    if (codes[0]) {
      setValue(codes[0].rawValue);
      setMethod(codes[0].format === "qr_code" ? "QR" : "Barcode");
      search(
        codes[0].rawValue,
        codes[0].format === "qr_code" ? "QR" : "Barcode",
      );
    } else notify("畫面未找到條碼");
  };
  const image = async (f: File) => {
    setBusy(true);
    try {
      const Detector = (window as any).BarcodeDetector;
      if (Detector) {
        const d = new Detector({
          formats: ["qr_code", "code_128", "ean_13", "ean_8"],
        });
        const codes = await d.detect(await createImageBitmap(f));
        if (codes[0]) {
          setValue(codes[0].rawValue);
          setMethod("Barcode");
          return search(codes[0].rawValue, "Barcode");
        }
      }
      const T = await import("tesseract.js");
      const r = await T.recognize(f, "eng+chi_tra");
      const text =
        r.data.text
          .trim()
          .split(/\s+/)
          .filter((x) => x.length > 2)[0] || r.data.text.trim();
      setValue(text);
      setMethod("OCR");
      await search(text, "OCR");
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
            <video ref={video} playsInline />
            <div className="scanline" />
            <button className="button light" onClick={scanFrame}>
              擷取並辨認
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
            placeholder="輸入 SKU、Label Code 或品名"
          />
          <button className="button" disabled={busy} onClick={() => search()}>
            <Search />
            搜尋
          </button>
        </div>
        <button
          className="mock"
          onClick={() => {
            const sample = items[0]?.labelCode || items[0]?.sku || "";
            setValue(sample);
            setMethod("Manual");
            search(sample, "Manual");
          }}
        >
          使用 Mock Scanner 測試第一件貨品
        </button>
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
              onClick={() => confirmItem(m)}
            >
              <div>
                <b>{m.item.name}</b>
                <small>
                  {m.item.sku} · {m.item.labelCode}
                </small>
              </div>
              <strong>{Math.round(m.confidence * 100)}%</strong>
              <span>確認盤點</span>
            </button>
          ))
        )}
      </div>
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
    await json("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, locationFilter: loc, categoryFilter: cat }),
    });
    setName("");
    notify("盤點批次已建立");
    load();
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
  const locs = [...new Set(items.map((i) => i.location))],
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
          placeholder="例如：八月 A 倉盤點"
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
        <button className="button" disabled={!name.trim()} onClick={create}>
          建立 Session
        </button>
      </div>
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
