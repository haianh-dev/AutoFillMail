# SH27 · Tạo thư mời KOL

Web nhỏ giúp Ban Đối ngoại **Ngày hội hiến máu Sắc Hồng Hy Vọng lần thứ XXVII** tạo thư mời KOL trong vài giây: chọn loại thư, nhập vài ô, nhận file HTML đã điền sẵn.

🔗 **Demo:** https://autofillmail.haianh-dev-nguyen.workers.dev/

## Vấn đề dự án giải quyết

Mỗi thư mời là một email HTML có 25 chỗ cần sửa tay (lĩnh vực, nghệ danh, xưng hô, tên người gửi, ngày hồi âm…). Làm tay vừa chậm vừa dễ sót hoặc sai xưng hô. Công cụ này tự điền đúng 25 chỗ đó và **giữ nguyên mọi thứ còn lại** của mẫu (bố cục, màu, ảnh, link, font).

## Tính năng

- 3 loại thư: **KMDH** (Khách mời đồng hành), **NVTCH** (Nhân vật truyền cảm hứng), **ĐSNH** (Đại sứ ngày hội).
- Xem trước trực tiếp khi gõ.
- Tự gợi ý "đệm + tên" từ họ và tên người gửi (sửa tay được).
- Xưng hô tự viết hoa đúng chỗ: `Anh`/`Chị` ở đầu câu, `anh`/`chị` ở giữa câu.
- Tải file `.html` hoặc sao chép HTML để dán vào công cụ gửi mail.
- Nhớ tạm tên người gửi và ngày hồi âm cho lần sau (lưu trên trình duyệt của bạn).

## Cách dùng

1. Chọn loại thư mời.
2. Nhập lĩnh vực, nghệ danh/tên KOL, chọn xưng hô, nhập họ tên của bạn và ngày hồi âm.
3. Kiểm tra phần xem trước, rồi bấm **Tải file HTML** hoặc **Sao chép HTML**.

## Công nghệ

HTML + CSS + JavaScript thuần, không framework, không backend, không phụ thuộc thư viện nào lúc chạy. Triển khai trên Cloudflare (static assets). Thống kê ẩn danh bằng GoatCounter.

## Cấu trúc thư mục

```
├─ app/                      # phần web được deploy
│  ├─ index.html
│  ├─ style.css
│  ├─ fill.js                # lõi: thay placeholder trong template
│  ├─ app.js                 # nối giao diện với fill.js
│  └─ templates.generated.js # SINH RA từ templates/, không sửa tay
├─ templates/                # 3 mẫu HTML gốc (kmdh, nvtch, dsnh)
├─ scripts/
│  ├─ build-templates.mjs    # templates/*.html → app/templates.generated.js
│  └─ verify.mjs             # bộ test tự động
├─ docs/                     # tài liệu đặc tả (dùng để giao việc cho AI)
└─ AGENTS.md
```

## Chạy trên máy

Không cần cài gì. Mở `app/index.html` bằng cách double-click là chạy.

## Khi sửa template

```bash
node scripts/build-templates.mjs   # sinh lại app/templates.generated.js
node scripts/verify.mjs            # chạy test, phải PASS hết
```

Sau đó commit và push, Cloudflare sẽ tự build lại.

## Nguyên tắc thay thế (quan trọng)

- Chỉ thay đúng 6 loại placeholder (25 vị trí mỗi thư), mọi ký tự khác giữ nguyên từng byte. Test `verify.mjs` kiểm tra điều này.
- Thay bằng thao tác chuỗi/regex trên văn bản thô, **không** dùng DOMParser, để không làm hỏng comment điều kiện của Outlook và merge tag Mailchimp.
- Dữ liệu người dùng nhập được escape HTML trước khi chèn.
- Chi tiết đầy đủ: xem `docs/03-TEMPLATE-SPEC.md`.

## Deploy (Cloudflare)

Dự án là web tĩnh, chỉ cần trỏ thư mục `app` làm thư mục assets. Ví dụ Deploy command:

```bash
npx wrangler deploy --assets ./app --name autofillmail --compatibility-date 2026-10-01
```

Nếu `app/` nằm trong thư mục con của repo, đổi `./app` thành đường dẫn tương ứng. Nhớ commit cả `app/templates.generated.js` vì build không tự sinh file này (trừ khi đặt Build command là `node scripts/build-templates.mjs`).

## Quyền riêng tư và thống kê

- Mọi xử lý diễn ra trên trình duyệt. Tên KOL và tên người gửi không được gửi lên server nào.
- Dùng [GoatCounter](https://www.goatcounter.com/) để đếm lượt truy cập và số lần bấm Tải/Sao chép (chỉ ghi tên sự kiện kèm loại thư, ví dụ `tai-kmdh`), không ghi nội dung người dùng nhập.
- Ai có link đều dùng được và xem được nội dung mẫu thư. Nếu chỉ dùng nội bộ, nên bật Cloudflare Access.

## Kết quả sử dụng

<!-- Điền số thật sau khi chạy sự kiện, ví dụ: "X thư mời được tạo trong tuần đầu của SH27". -->

## Tác giả

Hải Anh — làm cho Ban Đối ngoại, Sắc Hồng Hy Vọng lần thứ XXVII.
