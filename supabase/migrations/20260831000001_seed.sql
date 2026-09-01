INSERT INTO "InventoryItem" (
  "id", "sku", "labelCode", "name", "category", "quantity", "unit",
  "location", "minimumStock", "status", "remark", "updatedAt"
) VALUES
('seed-1001','SKU-1001','489000100001','無線條碼掃描器','電子設備',12,'件','A-01',3,'Checked','前台專用',CURRENT_TIMESTAMP),
('seed-1002','SKU-1002','489000100002','熱感標籤打印機','電子設備',4,'部','A-02',2,'Unchecked','',CURRENT_TIMESTAMP),
('seed-1003','SKU-1003','489000100003','80mm 標籤紙','耗材',2,'箱','B-01',5,'Low Stock','需補貨',CURRENT_TIMESTAMP),
('seed-1004','SKU-1004','489000100004','USB-C 充電線','配件',38,'條','A-03',10,'Checked','',CURRENT_TIMESTAMP),
('seed-1005','SKU-1005','489000100005','防水收納箱 45L','收納',8,'個','C-02',3,'Unchecked','',CURRENT_TIMESTAMP),
('seed-1006','SKU-1006','489000100006','工業膠帶','耗材',0,'卷','B-02',6,'Missing','上次未找到',CURRENT_TIMESTAMP),
('seed-1007','SKU-1007','489000100007','手推車','工具',3,'部','C-01',1,'Damaged','一部車輪待修',CURRENT_TIMESTAMP),
('seed-1008','SKU-1008','489000100008','棉質工作手套','安全用品',26,'對','D-01',8,'Checked','',CURRENT_TIMESTAMP),
('seed-1009','SKU-1009','489000100009','反光背心','安全用品',16,'件','D-01',5,'Unchecked','',CURRENT_TIMESTAMP),
('seed-1010','SKU-1010','INV-QR-1010','倉庫平板電腦','電子設備',5,'部','A-04',2,'Checked','QR label',CURRENT_TIMESTAMP),
('seed-1011','SKU-1011','INV-QR-1011','活動層架','收納',7,'組','C-03',2,'Unchecked','',CURRENT_TIMESTAMP),
('seed-1012','SKU-1012','489000100012','消毒清潔劑','清潔',9,'瓶','D-02',4,'Checked','',CURRENT_TIMESTAMP),
('seed-1013','SKU-1013','489000100013','黑色垃圾袋','清潔',3,'箱','D-03',4,'Low Stock','',CURRENT_TIMESTAMP),
('seed-1014','SKU-1014','489000100014','數位磅秤','工具',2,'部','B-04',1,'Unchecked','',CURRENT_TIMESTAMP),
('seed-1015','SKU-1015','INV-QR-1015','文件封箱','包裝',20,'個','B-03',6,'Checked','年度存檔',CURRENT_TIMESTAMP)
ON CONFLICT ("sku") DO UPDATE SET
  "labelCode" = EXCLUDED."labelCode",
  "name" = EXCLUDED."name",
  "category" = EXCLUDED."category",
  "quantity" = EXCLUDED."quantity",
  "unit" = EXCLUDED."unit",
  "location" = EXCLUDED."location",
  "minimumStock" = EXCLUDED."minimumStock",
  "status" = EXCLUDED."status",
  "remark" = EXCLUDED."remark",
  "updatedAt" = CURRENT_TIMESTAMP;
