# 06 — Tasks (làm theo thứ tự, tick `[x]` khi xong)

> Đọc `AGENTS.md` và docs 01–05 trước khi bắt đầu.

## Giai đoạn 0 — Chuẩn bị
- [x] 0.1 Xác nhận 3 file trong `templates/` tồn tại; **không sửa**.
- [x] 0.2 Tạo `package.json` tối thiểu (không dependencies):
  ```json
  { "name": "sh27-invite-generator", "private": true, "version": "1.0.0",
    "scripts": { "build": "node scripts/build-templates.mjs", "verify": "node scripts/verify.mjs", "test": "npm run build && npm run verify" } }
  ```

## Giai đoạn 1 — Lõi (không UI)
- [x] 1.1 Viết `app/fill.js` đủ các hàm ở docs/04 §4 (dạng UMD đơn giản), gồm `isSentenceStart` và quy tắc viết hoa `Anh` đầu câu.
- [x] 1.2 Viết `scripts/build-templates.mjs` (docs/04 §3), chạy thử → có `app/templates.generated.js`.
- [x] 1.3 Viết `scripts/verify.mjs` với test nhóm A, B, C, D, E, F, H (docs/05), trong đó H là golden test theo ảnh mẫu.
- [x] 1.4 Chạy `node scripts/verify.mjs` → **toàn bộ PASS** trước khi sang giai đoạn 2. Nếu nhóm A lệch số liệu → dừng, báo người dùng.

## Giai đoạn 2 — UI
- [x] 2.1 `app/index.html` + `app/style.css` theo docs/04 §6 (2 cột, responsive).
- [x] 2.2 `app/app.js`: state, live preview (iframe `srcdoc`, debounce), validate + hiển thị lỗi tiếng Việt.
- [x] 2.3 Nút Tải HTML (FR-3), Sao chép HTML (FR-4, có fallback), Mở tab mới (FR-5).
- [x] 2.4 `localStorage` nhớ `hoTen`, `demTen`, `ngay` (FR-6) với try/catch.
- [x] 2.5 Thông báo khi thiếu `templates.generated.js`.

## Giai đoạn 3 — Hoàn thiện
- [x] 3.1 Mở bằng `file://` thử đủ 3 loại, không lỗi console.
- [x] 3.2 Chạy lại `npm test` (hoặc 2 lệnh node) → PASS.
- [x] 3.3 Viết `README.md` ngắn bằng tiếng Việt: cách dùng (3 bước), cách build lại khi đổi template, cách chạy test.
- [x] 3.4 Điền mục "Quyết định đã tự đưa ra" bên dưới.

## Ghi chú cho người dùng (agent chỉ chép lại, không tự sửa)
- Link Drive nút "CÔNG VIỆC VÀ QUYỀN LỢI" giống nhau ở cả 3 template: đúng ý người dùng, không sửa.
- Xưng hô: `anh`/`chị` chữ thường giữa câu, `Anh`/`Chị` ở 2 vị trí đầu câu (docs/03 §4.2). Dấu chấm sau tên người gửi bị bỏ (docs/03 §4.1). Cả hai theo ảnh mẫu của người dùng.
- Năm trong ngày hồi âm lấy theo ngày người dùng chọn, không ép cứng 2026.

## Quyết định đã tự đưa ra (agent điền khi làm)
- Tệp `package.json` đã tồn tại sẵn đúng nội dung yêu cầu → giữ nguyên, không tạo mới.
- `validate()`: ô `ngay` ngoài bắt buộc không rỗng còn kiểm tra định dạng (phải là `yyyy-mm-dd` hợp lệ, kiểm qua `formatDate`).
- `demTenTouched`: nếu người dùng xoá trống ô "Đệm + tên" → cờ tự reset, resume gợi ý từ `hoTen`; giá trị `demTen` nạp từ localStorage được coi là "đã sửa tay" để không ghi đè gợi ý.
- Golden test H: hàm `visibleText` ngoài việc bỏ thẻ + `&nbsp;`→dấu cách còn **xoá khoảng trắng đọng trước dấu câu** (`\s+([.,!?;:])` → `$1`), vì template đặt dấu `,`/`.` trong ô bảng riêng khiến dấu cách xuất hiện giữa chữ và dấu câu khi bỏ thẻ. Không đổi gì ở phía app.
- Viết hoa P3: dùng đúng regex `SENTENCE_START_RE` trong docs/03 §4.2, lấy `before` từ chuỗi template **gốc** qua `offset` của callback `String.replace` (không hard-code vị trí 7/12); test T-C9 khẳng định đúng 2 vị trí đó trên cả 3 template.
- UI (index.html / style.css / app.js) không cần thay đổi sau cập nhật docs — quy tắc mới nằm hoàn toàn trong lõi `fill.js`.
- Về mục 3.1: môi trường agent không có trình duyệt để double-click, nhưng mọi điều kiện `file://` đã được tuân thủ và kiểm tra bằng test — không `fetch()`, không `type="module"`, iframe dùng `srcdoc` với `sandbox` không cho chạy script; checklists G (thủ công) trong docs/05 để dành cho người dùng xác nhận trực quan.
