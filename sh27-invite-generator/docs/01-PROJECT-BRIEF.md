# 01 — Project Brief

## Bối cảnh
Ngày hội hiến máu **Sắc Hồng Hy Vọng lần thứ XXVII** (SH27) cần gửi thư mời tới nhiều KOL/nghệ sĩ. Có 3 mẫu thư (email HTML kiểu Mailchimp), mỗi mẫu cho một vai trò:

| Mã | Vai trò | Template |
|---|---|---|
| `KMDH` | KHÁCH MỜI ĐỒNG HÀNH | `templates/kmdh.html` |
| `NVTCH` | NHÂN VẬT TRUYỀN CẢM HỨNG | `templates/nvtch.html` |
| `DSNH` | ĐẠI SỨ NGÀY HỘI | `templates/dsnh.html` |

Hiện tại người gửi phải mở từng file và sửa tay ~25 chỗ → chậm, dễ sót, dễ sai xưng hô.

## Mục tiêu
Một web nhỏ: **chọn loại → nhập vài ô → nhận file HTML đã điền**, giữ nguyên toàn bộ thiết kế gốc.

## Người dùng
Thành viên Ban Đối ngoại, dùng trên máy tính cá nhân, mở file local. Không cần đăng nhập, không có dữ liệu nhạy cảm, không lưu server.

## Trong phạm vi (In scope)
- Chọn 1 trong 3 loại thư
- Nhập: lĩnh vực, nghệ danh/tên KOL, xưng hô (anh/chị), họ và tên người gửi, đệm + tên người gửi (tự gợi ý), ngày hồi âm
- Xem trước (live preview)
- Tải file `.html` đã điền; sao chép HTML vào clipboard
- Nhớ tạm thông tin người gửi + ngày bằng `localStorage` cho lần sau

## Ngoài phạm vi (Out of scope)
- Gửi email, tích hợp Mailchimp/Gmail
- Chỉnh sửa nội dung thư ngoài các placeholder
- Quản lý danh sách KOL, nhập hàng loạt (CSV) — có thể làm sau, **không làm bây giờ**
- Đăng nhập, backend, database, deploy
- Sửa/đồng nhất 3 template

## Tiêu chí thành công
1. Điền xong → mở file xuất ra trong trình duyệt trông **y hệt** template gốc, chỉ khác phần đã thay.
2. Không còn sót placeholder dạng `[...]` hay `.../.../2026` trong file xuất ra.
3. Cả quy trình < 30 giây cho 1 thư.
