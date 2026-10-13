# 02 — Requirements

## 1. Form đầu vào

| # | Nhãn UI (tiếng Việt) | Key | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|---|---|
| 1 | Loại thư mời | `type` | chọn 1 trong 3 (nút/segmented) | ✔ | `KMDH` · `NVTCH` · `ĐSNH` — hiển thị mã + tên đầy đủ nhỏ bên dưới |
| 2 | Lĩnh vực | `linhVuc` | text | ✔ | Ví dụ: `Ca sĩ`, `Diễn viên`, `MC`. Giữ nguyên chữ hoa/thường người dùng nhập |
| 3 | Nghệ danh / Tên KOL | `ngheDanh` | text | ✔ | Ví dụ: `Hà Anh Tuấn` |
| 4 | Xưng hô | `xungHo` | chọn `anh` / `chị` | ✔ | Mặc định `anh`. Xuất **chữ thường** ở giữa câu, **viết hoa chữ đầu (`Anh`/`Chị`) khi đứng đầu câu** (2 vị trí/template, xem docs/03 §4.2) |
| 5 | Họ và tên của bạn | `hoTen` | text | ✔ | Ví dụ: `Nguyễn Hải Anh` |
| 6 | Đệm + tên của bạn | `demTen` | text | ✔ | **Tự gợi ý** từ `hoTen` = 2 từ cuối (nếu chỉ 1 từ thì lấy 1 từ). Người dùng có thể sửa; nếu đã sửa tay thì ngừng tự gợi ý cho tới khi họ xoá trống |
| 7 | Ngày hồi âm | `ngay` | `<input type="date">` | ✔ | Xuất dạng `dd/mm/yyyy` |

### Validation
- Mọi ô bắt buộc: `trim()` rồi không được rỗng. Ô lỗi viền đỏ + dòng lỗi tiếng Việt ("Vui lòng nhập …").
- Gộp nhiều khoảng trắng liên tiếp thành 1 (`"Hà   Anh"` → `"Hà Anh"`).
- Chưa hợp lệ → vẫn hiện preview của template gốc (placeholder còn nguyên) hoặc preview 1 phần, nhưng **nút Tải / Sao chép bị vô hiệu hoá**.
- Giới hạn độ dài mỗi ô text: 80 ký tự.

## 2. Hành vi

- **FR-1 Live preview**: mỗi lần đổi bất kỳ ô nào → tạo lại HTML và cập nhật iframe preview (debounce ≤ 150 ms).
- **FR-2 Đổi loại**: đổi loại thư → preview chuyển sang template tương ứng, giữ nguyên giá trị các ô khác.
- **FR-3 Tải về**: nút "Tải file HTML" tải `<tên-file>.html`, UTF-8, MIME `text/html;charset=utf-8`.
  - Tên file: `SH27-<type>-<slug nghệ danh>.html`, ví dụ `SH27-kmdh-ha-anh-tuan.html`.
  - `slug`: bỏ dấu tiếng Việt (NFD + xoá combining marks, `đ→d`), chữ thường, ký tự không phải chữ/số → `-`, gộp `-` liên tiếp, bỏ `-` đầu/cuối.
- **FR-4 Sao chép HTML**: nút "Sao chép HTML" ghi toàn bộ chuỗi HTML đã điền vào clipboard (dùng `navigator.clipboard.writeText`, có fallback `textarea + execCommand('copy')` cho `file://`). Hiện toast "Đã sao chép".
- **FR-5 Mở tab mới** (tuỳ chọn, nên có): mở HTML đã điền trong tab mới qua Blob URL.
- **FR-6 Nhớ tạm**: lưu `hoTen`, `demTen`, `xungHo`(không), `ngay` vào `localStorage` key `sh27.sender`; nạp lại khi mở app. Bọc try/catch (localStorage có thể bị chặn). **Không** lưu thông tin KOL.
- **FR-7 An toàn HTML**: mọi giá trị người dùng nhập phải được **escape HTML** (`& < > " '`) trước khi chèn (xem docs/03 §5).
- **FR-8 Không sót placeholder**: trước khi cho tải, kiểm tra output không còn bất kỳ pattern placeholder nào (xem docs/03 §3). Nếu còn → báo lỗi, chặn tải.

## 3. Phi chức năng
- Chạy bằng double-click `app/index.html`, Chrome/Edge/Firefox bản mới.
- Không phụ thuộc mạng để chạy app (ảnh trong thư mời là link ngoài, chỉ ảnh hưởng preview khi offline — chấp nhận được).
- Giao diện gọn, 1 trang, 2 cột (form trái, preview phải), responsive xuống 1 cột trên màn hình hẹp.
- Zero dependency runtime.

## 4. Tiêu chí nghiệm thu (Acceptance)

| ID | Điều kiện | Kết quả mong đợi |
|---|---|---|
| AC-1 | Chọn KMDH, nhập đủ, tải file | Mở file thấy tiêu đề nút "THƯ MỜI KHÁCH MỜI ĐỒNG HÀNH", 11 chỗ `[Anh/Chị]` giữa câu thành `anh`/`chị` (thường), 2 chỗ đầu câu thành `Anh`/`Chị` (hoa); dòng ký tên là tên người gửi, **không** có dấu chấm cuối |
| AC-2 | Làm tương tự với NVTCH và ĐSNH | Đúng tên vai trò tương ứng; link Drive của nút "THƯ MỜI …" đúng của từng loại (không bị lẫn giữa 3 file) |
| AC-3 | So sánh output với template | Chỉ khác ở 25 vị trí placeholder (test `verify.mjs`) |
| AC-4 | Nhập nghệ danh có ký tự đặc biệt `B Ray & Co <3` | HTML vẫn hợp lệ, hiển thị đúng `B Ray & Co <3` |
| AC-5 | Nhập nghệ danh chứa `$&` hoặc `$1` | Hiển thị nguyên văn, không bị JS thay thế |
| AC-6 | Bỏ trống 1 ô bắt buộc | Nút tải bị khoá, có thông báo |
| AC-7 | Mở bằng `file://` | Không lỗi CORS/console |
| AC-8 | Tên "Nguyễn Hải Anh" | `demTen` tự gợi ý "Hải Anh" |
| AC-9 | Nhập đúng bộ dữ liệu mẫu ở docs/05 §H (Diễn viên / Lưu Duy Khánh / anh / Nguyễn Hải Anh / 16/10/2026) | Mọi câu trong docs/05 §H xuất hiện nguyên văn trong output (khớp với ảnh mẫu của người dùng) |
