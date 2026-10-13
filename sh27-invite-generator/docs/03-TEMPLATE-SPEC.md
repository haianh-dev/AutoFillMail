# 03 — Template Spec (QUAN TRỌNG NHẤT)

Tài liệu này mô tả chính xác 3 file trong `templates/` và cách thay placeholder. Mọi số liệu dưới đây đã được kiểm chứng trên cả 3 file.

## 1. Bản chất template
- Là email HTML xuất từ **Mailchimp** (bảng lồng nhau, CSS inline, conditional comment Outlook `<!--[if mso]> … <![endif]-->`, merge tag `*|MC:SUBJECT|*`, `*|MC_PREVIEW_TEXT|*`).
- UTF-8, xuống dòng `LF`, **không BOM**, **không có ký tự `U+00A0` thô** (khoảng trắng không ngắt được viết dạng thực thể `&nbsp;`).
- 4 ảnh/mỗi file đều là link ngoài (`src="https://…"`), không có ảnh nhúng base64.
- Placeholder **chỉ nằm trong `<body>`**, không có trong `<head>`/`<title>`.
- Merge tag Mailchimp `*|…|*` **KHÔNG phải placeholder của dự án này** → giữ nguyên.

## 2. Danh sách placeholder (6 loại, 25 vị trí / file)

| # | Chuỗi trong template (viết đúng từng ký tự) | Số lần | Thay bằng | Nguồn |
|---|---|---|---|---|
| P1 | `[Lĩnh vực]` | 1 | lĩnh vực | `linhVuc` |
| P2 | `[Nghệ danh/&nbsp;tên KOLs]` | 8 | nghệ danh/tên KOL | `ngheDanh` |
| P3 | `[Anh/Chị]` | 13 | `anh`/`chị` — **11 chỗ thường, 2 chỗ đầu câu viết hoa** (`Anh`/`Chị`), xem §4.2 | `xungHo` |
| P4 | `[đệm + tên]` | 1 | đệm + tên người gửi | `demTen` |
| P5 | `[Họ và tên].` (**gồm cả dấu chấm đi kèm**) | 1 | họ và tên người gửi, **không** kèm dấu chấm | `hoTen` |
| P6 | `.../.../2026` | 1 | ngày hồi âm `dd/mm/yyyy` | `ngay` |
| | **Tổng** | **25** | | |

> Lưu ý P2: giữa `/` và `tên` là **thực thể `&nbsp;` (6 ký tự văn bản)**, không phải khoảng trắng thường. Regex nên chấp nhận cả `&nbsp;`, khoảng trắng thường hoặc không có gì ở vị trí đó cho an toàn.

## 3. Regex gộp (single-pass)

Dùng **một regex duy nhất** với flag `g`, và hàm callback trả về giá trị theo token. Lý do: thay từng token tuần tự có thể quét lại phần vừa chèn (vd nghệ danh người dùng gõ có chứa `[Anh/Chị]`).

```js
const PLACEHOLDER_RE =
  /\[Lĩnh vực\]|\[Nghệ danh\/(?:&nbsp;|\s)?tên KOLs\]|\[Anh\/Chị\]|\[đệm \+ tên\]|\[Họ và tên\]\.?|\.\.\.\/\.\.\.\/2026/g;
```

Phân loại token trong callback (so sánh sau khi chuẩn hoá):
- bắt đầu `[Lĩnh` → `linhVuc`
- bắt đầu `[Nghệ` → `ngheDanh`
- bằng `[Anh/Chị]` → `xungHo`
- bắt đầu `[đệm` → `demTen`
- bắt đầu `[Họ` → `hoTen` (token có thể kèm dấu `.` ở cuối, bị thay luôn)
- bắt đầu `...` → `ngay`

Kiểm tra "không sót" (dùng ở FR-8 và test): sau khi điền, output **không** khớp bất kỳ pattern nào sau:
```js
/\[(?:Lĩnh vực|Nghệ danh|Anh\/Chị|đệm|Họ và tên)[^\]]*\]/   // placeholder dạng ngoặc vuông
/\.\.\.\/\.\.\.\/2026/                                      // ngày chưa điền
```

## 4. Quy tắc thay thế
1. Chỉ thay **chuỗi khớp token**, giữ nguyên mọi ký tự xung quanh — kể cả `&nbsp;` đứng ngay sau token và thẻ `<strong>`/`<em>` bao quanh. **Ngoại lệ duy nhất:** dấu chấm ngay sau `[Họ và tên]` thuộc về token P5 và bị thay luôn (template viết `<em>[Họ và tên].</em>` → output `<em>Nguyễn Hải Anh</em>`, theo mẫu của người dùng).
2. **P3 — viết hoa theo vị trí câu.** Giá trị gốc là `anh` hoặc `chị` (chữ thường). Nếu token đứng **đầu câu** thì viết hoa chữ cái đầu (`Anh`/`Chị`), còn lại giữ thường. Đây là hành vi theo mẫu người dùng ("Anh Lưu Duy Khánh thân mến…", "…hy vọng anh có thể…", "Anh có thể liên hệ…").
   - Hàm `isSentenceStart(before)` — `before` là tối đa 200 ký tự **gốc của template** ngay trước token (lấy từ chuỗi template gốc, không phải chuỗi đang thay dở):
     ```js
     const SENTENCE_START_RE =
       /(?:[.!?]|<p\b[^>]*>)(?:\s|&nbsp;|<\/?(?:strong|em|span|b|i)\b[^>]*>)*$/;
     const isSentenceStart = (before) => SENTENCE_START_RE.test(before);
     ```
     Nghĩa là: ngay trước token (bỏ qua khoảng trắng, `&nbsp;`, thẻ `strong/em/span/b/i`) là dấu kết câu `. ! ?` hoặc thẻ mở `<p …>`.
   - Kết quả đã kiểm chứng trên cả 3 template: trong 13 token P3, **đúng 2 token** đầu câu: **thứ 7** (đầu đoạn "`…thân mến, sự đồng hành…`") và **thứ 12** (sau `trước ngày …</em>.&nbsp;`, trước "`có thể liên hệ Ms. Thanh Huyền`"). 11 token còn lại viết thường. (Đếm theo thứ tự xuất hiện trong file.)
   - Không được hard-code theo số thứ tự; dùng `isSentenceStart` và để test (docs/05) khẳng định đúng 2 vị trí.
3. P1 và P2 xuất đúng chữ hoa/thường người dùng nhập, không tự đổi.
4. P6 thay **cả cụm** `.../.../2026` bằng `dd/mm/yyyy`; phần `trước ngày ` đứng trước và thẻ `<em>` bao quanh được giữ. Năm lấy từ ngày người dùng chọn (không ép 2026).
5. Thay bằng **callback** (`str.replace(RE, (m) => …)`), **không** dùng chuỗi thay thế trực tiếp — vì `$&`, `$1`, `$$` trong dữ liệu người dùng sẽ bị JS diễn giải.

## 5. Escape dữ liệu người dùng
Trước khi chèn, mỗi giá trị đi qua:
```js
const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
```
Sau đó chuẩn hoá khoảng trắng (`trim`, gộp nhiều khoảng trắng → 1) **trước** khi escape.
Chữ có dấu tiếng Việt **không** chuyển thành thực thể số — để nguyên UTF-8.

Ví dụ: nghệ danh `B Ray & Co <3` → chèn `B Ray &amp; Co &lt;3`.

## 6. Khác biệt giữa 3 template (PHẢI giữ nguyên, không đồng nhất hoá)

Cấu trúc & style giống nhau, chỉ khác các điểm sau. Vì vậy **mỗi loại dùng đúng file của nó**; tuyệt đối không dùng 1 file rồi đổi tên vai trò bằng find-replace.

| Điểm khác | `kmdh` | `nvtch` | `dsnh` |
|---|---|---|---|
| Tên vai trò (in đậm trong thân thư, tiêu đề nút, `title=""`) | `KHÁCH MỜI ĐỒNG HÀNH` | `NHÂN VẬT TRUYỀN CẢM HỨNG` | `ĐẠI SỨ NGÀY HỘI` |
| Chữ trên nút đầu | `THƯ MỜI KHÁCH MỜI ĐỒNG HÀNH` | `THƯ MỜI NHÂN VẬT TRUYỀN CẢM HỨNG` | `THƯ MỜI ĐẠI SỨ NGÀY HỘI` |
| Chữ trên nút cuối | `CÔNG VIỆC VÀ QUYỀN LỢI CỦA KHÁCH MỜI ĐỒNG HÀNH` | `…CỦA NHÂN VẬT TRUYỀN CẢM HỨNG` | `…CỦA ĐẠI SỨ NGÀY HỘI` |
| Link Drive của nút đầu (thư mời) | `…/d/1_4uVHJusoJql_udP1bY7ab-nz16W9cQ1/…` | `…/d/1J7UleXoM5ztNxuBo9mEzUMVwz7vt0aKt/…` | `…/d/1AGF15VX4-Hzf-fP4KdEa3mLUIwE8_51v/…` |
| `border-radius` của 1 nút | `14px` | `13px` | `13px` |
| Dòng địa điểm | `…tòa đa năng Trường Đại học…` | `…tòa đa năng Trường Đại học…` | `…tòa đa năng**,** Trường Đại học…` (có dấu phẩy) |

> Link Drive của nút `CÔNG VIỆC VÀ QUYỀN LỢI CỦA …` giống nhau ở cả 3 file — **đúng ý người dùng, không sửa**.

Giữ nguyên tất cả — kể cả những chỗ trông như "lỗi nhỏ" (dấu phẩy thừa, 13px vs 14px). Người dùng muốn giữ nguyên mọi thứ ngoài placeholder.

Các thứ **giống nhau** ở cả 3 file (không đụng): link Drive nút giữa (Timeline) và nút cuối, `mailto:uetsachonghyvong@gmail.com`, Facebook, Instagram, hotline (Mr. Hữu Dương 0966 064 608, Ms. Thanh Huyền 0335 401 260), thời gian/địa điểm sự kiện, toàn bộ ảnh và CSS.

## 7. Ví dụ đầu vào → đầu ra (KMDH)

Input:
```
linhVuc = "Diễn viên"    ngheDanh = "Lưu Duy Khánh"   xungHo = "anh"
hoTen   = "Nguyễn Hải Anh"  demTen = "Hải Anh"          ngay = 2026-10-16
```
Biến đổi (chỉ phần được thay):

| Template | Output |
|---|---|
| `Thân gửi <strong>[Lĩnh vực] [Nghệ danh/&nbsp;tên KOLs]</strong>,` | `Thân gửi <strong>Diễn viên Lưu Duy Khánh</strong>,` |
| `đến <strong>[Anh/Chị]&nbsp;[Nghệ danh/&nbsp;tên KOLs]</strong>.` | `đến <strong>anh&nbsp;Lưu Duy Khánh</strong>.` |
| `Em là [đệm + tên] - Phụ trách Đối ngoại` | `Em là Hải Anh - Phụ trách Đối ngoại` |
| `<em>trước ngày .../.../2026</em>` | `<em>trước ngày 16/10/2026</em>` |
| `<em>[Họ và tên].</em>` | `<em>Nguyễn Hải Anh</em>` (bỏ dấu chấm) |
| `.&nbsp;<strong>[Anh/Chị] </strong>có thể liên hệ` (đầu câu) | `.&nbsp;<strong>Anh </strong>có thể liên hệ` (viết hoa) |
| `<strong>[Anh/Chị]&nbsp;[Nghệ danh/&nbsp;tên KOLs]&nbsp;</strong>` (đầu đoạn, trước "thân mến") | `<strong>Anh&nbsp;Lưu Duy Khánh&nbsp;</strong>` (viết hoa) |

> Lưu ý: `anh&nbsp;Lưu Duy Khánh` — `&nbsp;` giữa hai thành phần là của template, giữ nguyên.

## 8. Cấm kỵ (đã lường trước)
- ❌ `DOMParser`, `innerHTML`, `outerHTML`, `XMLSerializer`, cheerio, jsdom để "parse rồi thay" → làm hỏng comment điều kiện Outlook và thứ tự/định dạng thuộc tính.
- ❌ Thay bằng `str.replaceAll('[Anh/Chị]', value)` với value thô → dính `$`-pattern và không escape.
- ❌ Trim/format lại HTML (prettier, minify, đổi xuống dòng `LF→CRLF`).
- ❌ Chèn `<base>`, `<script>`, `<meta>` hay comment vào output (kể cả để phục vụ preview — preview xử lý ngoài iframe).
- ❌ Sửa merge tag `*|…|*`.
