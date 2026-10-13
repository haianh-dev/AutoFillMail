# SH27 Invite Generator

Web tĩnh tạo thư mời KOL cho **Ngày hội hiến máu Sắc Hồng Hy Vọng lần thứ XXVII** — chọn loại thư, nhập vài ô, nhận file HTML đã điền, giữ nguyên 100% thiết kế gốc. Không backend, không thư viện ngoài.

## Cách dùng (3 bước)

1. Mở **`app/index.html`** bằng double-click (Chrome/Edge/Firefox).
2. Chọn loại thư (**KMDH / NVTCH / ĐSNH**), điền thông tin KOL + người gửi + ngày hồi âm — xem trước cập nhật ngay bên phải.
3. Bấm **"Tải file HTML"** (hoặc **"Sao chép HTML"** để dán vào Mailchimp/Gmail). Có thể bấm **"Mở tab mới"** để xem toàn màn hình.

Lần sau mở lại, app tự nhớ họ tên, đệm + tên và ngày hồi âm của bạn (localStorage của trình duyệt, không gửi đi đâu).

## Build lại khi template thay đổi

Template trong `templates/` là nguồn sự thật (chỉ đọc). Nếu được cấp file `.html` mới, chỉ cần chạy:

```bash
node scripts/build-templates.mjs
```

Script đọc 3 file và sinh `app/templates.generated.js` (template được nhúng vào JS vì `file://` không cho `fetch()` file local).

## Chạy test

```bash
node scripts/verify.mjs        # toàn bộ test A–F
# hoặc
npm test                       # build + verify
```

Test kiểm tra: đúng 25 placeholder/file, output **giống hệt từng byte** template gốc ngoài 25 vị trí thay, escape HTML đúng, không lẫn vai trò/link giữa 3 template.

## Lưu ý

- Không sửa gì trong `templates/` — mọi khác biệt nhỏ giữa 3 mẫu (dấu phẩy, 13px/14px…) là cố ý.
- Xưng hô: `anh`/`chị` chữ thường giữa câu, tự viết hoa `Anh`/`Chị` ở 2 vị trí đầu câu trong mỗi thư (theo ảnh mẫu).
- Dấu chấm sau tên người ký ở cuối thư được bỏ (`<em>Nguyễn Hải Anh</em>`, không có `.`) — token P5 gồm cả dấu chấm trong template.
