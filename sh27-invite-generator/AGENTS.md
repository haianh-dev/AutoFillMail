# AGENTS.md — SH27 Invite Generator

> Đây là file vào cửa. Đọc file này TRƯỚC, rồi đọc các docs theo thứ tự bên dưới, rồi tự code. Không cần hỏi lại người dùng trừ khi gặp mục "Khi nào được hỏi".

## Dự án là gì (1 đoạn)
Web tĩnh nhỏ, chạy hoàn toàn trên trình duyệt (không backend). Người dùng chọn **loại thư mời** (KMDH / NVTCH / ĐSNH), nhập thông tin KOL + tên người gửi + ngày hồi âm. App lấy **file HTML mẫu có sẵn** trong `templates/`, **chỉ thay đúng 6 loại placeholder (25 vị trí)**, giữ nguyên 100% phần còn lại, rồi cho xem trước + tải/copy file HTML đã điền.

## Thứ tự đọc docs
1. `docs/01-PROJECT-BRIEF.md` — mục tiêu, phạm vi, không làm gì
2. `docs/02-REQUIREMENTS.md` — yêu cầu chức năng + form + tiêu chí nghiệm thu
3. `docs/03-TEMPLATE-SPEC.md` — **QUAN TRỌNG NHẤT**: placeholder chính xác, quy tắc thay, khác biệt giữa 3 template
4. `docs/04-TECH-PLAN.md` — stack, cấu trúc thư mục, thuật toán, UI
5. `docs/05-TEST-PLAN.md` — test bắt buộc chạy được
6. `docs/06-TASKS.md` — checklist làm theo thứ tự, tick dần

## Luật cứng (vi phạm = làm sai)
1. **KHÔNG sửa** bất kỳ file nào trong `templates/`. Chúng là nguồn sự thật, chỉ đọc.
2. Thay thế bằng **thao tác chuỗi (string/regex trên text thô)**. **CẤM** dùng DOMParser / innerHTML / cheerio / serialize lại HTML — sẽ làm hỏng conditional comment Outlook (`<!--[if mso]>`), merge tag Mailchimp (`*|...|*`) và thứ tự thuộc tính.
3. HTML xuất ra phải **giống hệt template từng byte**, ngoại trừ 25 vị trí placeholder. Phải có test chứng minh điều này (xem docs/05).
4. **Không thêm gì vào HTML xuất ra** (không script, không meta, không base tag, không comment).
5. Không framework (React/Vue/…), không backend, không gọi mạng, không thư viện runtime. Chỉ HTML + CSS + JS thuần. Node chỉ dùng cho script build/verify, **không cần `npm install` gì cả**.
6. Mở `app/index.html` bằng double-click (giao thức `file://`) phải chạy được. → Không `fetch()` template, không ES module `type="module"`.
7. Giao diện + thông báo lỗi bằng **tiếng Việt**.
8. 3 template **không được đồng nhất hoá** (xem docs/03 mục "Khác biệt"). Không tự "sửa lỗi chính tả/dấu phẩy" trong template.

## Khi nào được hỏi người dùng
Chỉ hỏi nếu: file trong `templates/` thiếu/hỏng, hoặc số vị trí placeholder không đúng bảng ở docs/03. Mọi chi tiết khác: tự quyết theo docs, ghi quyết định vào cuối `docs/06-TASKS.md`.

## Definition of Done
- `node scripts/build-templates.mjs` chạy OK, sinh `app/templates.generated.js`
- `node scripts/verify.mjs` pass toàn bộ test
- Mở `app/index.html` → chọn loại, nhập form → preview đúng → tải được file `.html`
- Tất cả ô trong `docs/06-TASKS.md` đã tick
