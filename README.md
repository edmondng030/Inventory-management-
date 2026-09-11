# Stockroom Inventory Management System

可在桌面及手機瀏覽器運行的本機庫存管理系統。介面以繁體中文為主，資料持久儲存在 Supabase PostgreSQL。

## 功能

桌面與手機均以畫面左側固定旗標展開選單；展開後旗標移到選單右邊，可按「收合」或 Escape 關閉。庫存列表預設為「全部（含已封存）」，搜尋忽略大小寫並包含編號、PO、描述、備註、位置及部門名稱；按「搜尋全部部門及封存項目」可保留搜尋字詞並解除其他篩選。封存只停用項目，不會從全項目搜尋移除。盤點批次可展開已盤點項目的目前完整資料和本批次盤點紀錄；未把目前 item 欄位當作歷史快照。相機確認及 Dashboard 仍使用使用中資產，封存項目需先還原才可盤點。

### 找回已封存項目

在庫存 Inventory 按「找回已封存項目」，會保留搜尋字詞、切換全部部門並清除狀態／分類／位置條件。也可使用「使用中／已封存／全部（含已封存）」篩選。搜尋 Inventory Code 後，在 Actions 按「還原 item」並確認；還原保留原 item ID、編號、數量、部門、盤點及借還歷史，新增 RESTORE Audit Log。原部門如已刪除，item 維持未分配，可還原後再轉移。還原不會更新 Latest Review Date 或標記 Checked。權限沿用登入使用者可操作庫存的模式。

### 部門盤點批次

先在上方選定 Inventory／部門，再建立 NEW CHECK SESSION；「全部 Inventory」不能建立新批次。位置與分類是部門範圍內的附加條件。建立時保存 item ID 清單，後續匯入、轉移或刪除部門不會擴大或縮小這份清單。請先完成匯入再建立批次。

在批次卡按「開始此批次掃描」，相機／圖片／手動搜尋及確認會歸入該批次，後端拒絕清單外項目、已結束批次及重複盤點。退出批次掃描後回復快速盤點。Expected／Checked／Unchecked、未盤點清單、Missing 和批次 Excel 使用同一清單；已封存項目保留在 Expected 中但不會被更新為 Missing。批次匯出的 Audit Logs 是清單內 items 的完整歷史，並非只限本次活動。

部署需執行 `npm run db:migrate`，新增 migration `20260909000000_session_inventory_scope`。舊批次無法可靠推斷原部門，因此保留舊範圍並標示「舊批次（未指定部門）」，只在「全部 Inventory」下列出；如需部門盤點請新建批次。

- Dashboard：品項、總數量、已／未盤點、需留意項目及最近活動
- Inventory CRUD、數量加減、搜尋篩選、分頁、批量狀態及軟封存
- 每次建立、修改、數量調整、匯入、盤點及封存均寫入 Audit Log
- Excel xlsx／xls／csv：Sheet 選擇、預覽、中英欄名 mapping、驗證、upsert、錯誤報告
- Excel 匯出含 Inventory、Check Logs、Audit Logs、Summary，可重新匯入
- 手機盤點：後置鏡頭連續對焦、Barcode／QR／Data Matrix／PDF417、多階段影像強化 Tesseract OCR、多候選 Inventory 比對及手動辨認
- Check Session：範圍、進度、重複掃描保護、結束盤點、批量 Missing、歷史紀錄
- 多部門 Inventory：管理員可建立及刪除部門，庫存、Dashboard 及 Excel 匯入可按部門分開；刪除部門不會刪除 Items 或歷史紀錄
- 使用者帳戶：首位註冊者為 Admin，Admin 可建立一般使用者／管理員帳戶；30 日 HttpOnly session
- 帳戶管理：使用者可修改密碼；忘記密碼申請由 Admin 設定臨時密碼；Admin 可停用、重新啟用或軟刪除帳戶
- 借出／歸還：掃描 Label 後確認借出，再掃描同一 Item 可歸還；列表顯示 Borrowed 與借用者，Loan/Audit Log 完整保留

## 技術架構

Next.js 16 App Router + TypeScript + Tailwind CSS 4、Supabase PostgreSQL + Prisma 6、SheetJS、BarcodeDetector、Tesseract.js、Zod、Vitest。登入使用 Node.js scrypt 密碼雜湊與資料庫 session，不依賴付費身份服務。

## 安裝及啟動

需要 Node.js 20.9+（建議 22 LTS）及 npm。

    npm install
    npm run db:setup
    npm run dev

將 Supabase transaction pooler 連線設為 DATABASE_URL、direct connection 設為 DIRECT_URL，再開啟 http://localhost:3000。資料持久儲存在 Supabase PostgreSQL。

首次開啟會前往 `/login` 建立管理員帳戶。登入後先用頁首「Create Inventory」建立部門；Admin 可到「使用者帳戶」建立其他登入帳戶及指定所屬部門。

使用者可從「修改密碼」輸入目前密碼及新密碼；完成後其他裝置的 session 會失效。忘記密碼時在登入頁提交電郵，Admin 會在「使用者帳戶」看到待處理申請並設定臨時密碼。系統不寄送電郵，臨時密碼需由組織內部安全渠道交給使用者。

Production：

    npm run build
    npm start

正式環境以 npm run db:migrate 套用 prisma/migrations；開發期間可用 npm run db:push。系統不會自動建立示範庫存。

## Excel 格式與操作

主要欄位：PO No.、Inventory Code、Product Code、Product Description、Qty、Serial No.、User/ Location、Status。Product Description 必填；Inventory Code、SKU 或 Label Code 至少一項必填且唯一。Qty 必須為非負整數。Status 可匯入 Y/N，系統會轉為 Checked/Unchecked；亦支援 Missing、Damaged 及 Borrowed。

到「Excel 匯入」拖放檔案，選擇 Sheet、檢查 mapping 與預覽，確認後才提交。相同 Inventory Code、SKU 或 Label Code 會更新，否則新增。錯誤可下載。右上角可匯出全部；session 卡可匯出指定批次。

可在 Excel 匯入頁下載空白範本 `public/templates/inventory-import-template.xlsx`；範本不包含示範資料。

## 手機相機實機測試

1. 執行 npm run dev -- --hostname 0.0.0.0，讓同一區域網絡手機連線。
2. 相機通常只允許 HTTPS 或 localhost；區網 HTTP 若被阻擋，請用可信任的本機 HTTPS proxy／憑證。
3. 到「流動盤點」允許鏡頭權限，對準實際 item label，點「擷取並辨認」。
   保持鏡頭平穩，讓 Label 號碼佔畫面大部分並避免反光；系統會依次使用高對比、二值化和原圖 OCR，完全匹配 Inventory Code 的結果優先。
4. Safari／Firefox 若沒有 BarcodeDetector，使用上載相片、OCR 或手動輸入。
5. 候選必須人工確認。按「確認借出」後 Status 會變為 Borrowed，User/Location 顯示登入者；再次掃描會顯示「確認歸還」。「只作盤點」則更新 Checked time、Check Log 與 Audit Log。

## 驗證指令

    npm run lint
    npm run typecheck
    npm test
    npm run build

## 安全、限制與假設

後端 Zod 驗證、Prisma 參數化查詢、Supabase PostgreSQL transaction、10MB UI／10,000 列 API 限制。數量不可為負。輸出以 = + - @ 開頭的文字會加單引號，防 formula injection。封存採 soft delete；時間以 UTC 儲存，UI 依瀏覽器時區顯示。

- MVP 角色為 ADMIN／USER；不提供外部電郵寄送或公開自行註冊。帳戶刪除採軟刪除及匿名化，以保留歷史 Loan Log。
- BarcodeDetector 支援度因瀏覽器不同；OCR 首次下載語言資源且較慢，完全離線首次使用前需準備語言檔。
- SheetJS 社群版可處理固定欄名、日期、數值與欄寬，但 header 樣式有限。
- Session API 支援 sessionId 掃描；MVP 快速掃描 UI 尚未提供「目前 Session」選擇器。
- 重複資料在預覽以不分大小寫檢查；PostgreSQL unique 約束保護最終資料。
- Item 數量假設為整數；Remark 不因盤點覆寫，盤點狀態獨立放在 Check Log。

日後可加入細粒度 RBAC、忘記密碼、多倉調撥、PWA 離線、盤點排程、Barcode 列印、備份、圖片附件及 ZXing fallback。
