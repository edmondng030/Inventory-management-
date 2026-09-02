# Stockroom Inventory Management System

可在桌面及手機瀏覽器運行的本機庫存管理系統。介面以繁體中文為主，資料持久儲存在 Supabase PostgreSQL。

## 功能

- Dashboard：品項、總數量、已／未盤點、需留意項目及最近活動
- Inventory CRUD、數量加減、搜尋篩選、分頁、批量狀態及軟封存
- 每次建立、修改、數量調整、匯入、盤點及封存均寫入 Audit Log
- Excel xlsx／xls／csv：Sheet 選擇、預覽、中英欄名 mapping、驗證、upsert、錯誤報告
- Excel 匯出含 Inventory、Check Logs、Audit Logs、Summary，可重新匯入
- 手機盤點：後置鏡頭 Barcode／QR、圖片 Barcode、Tesseract OCR、手動辨認
- Check Session：範圍、進度、重複掃描保護、結束盤點、批量 Missing、歷史紀錄
- 多部門 Inventory：管理員可建立部門，庫存、Dashboard 及 Excel 匯入可按部門分開
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
