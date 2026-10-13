# 05 — Test Plan

Tất cả test tự động nằm trong `scripts/verify.mjs`, chạy bằng `node scripts/verify.mjs`, in `PASS/FAIL` từng test, thoát mã ≠ 0 nếu có test fail. Chỉ dùng module có sẵn của Node (`node:fs`, `node:assert`, `node:path`, `node:crypto`). Nạp lõi bằng `require('../app/fill.js')` (qua `createRequire`) và đọc template trực tiếp từ `templates/`.

## A. Test cấu trúc template (sanity)
Với mỗi `kmdh`, `nvtch`, `dsnh`:

| ID | Kiểm tra | Mong đợi |
|---|---|---|
| T-A1 | Số khớp P1 `[Lĩnh vực]` | 1 |
| T-A2 | Số khớp P2 `[Nghệ danh/&nbsp;tên KOLs]` | 8 |
| T-A3 | Số khớp P3 `[Anh/Chị]` | 13 |
| T-A4 | Số khớp P4 `[đệm + tên]` | 1 |
| T-A5 | Số khớp P5 `[Họ và tên].` (kèm dấu chấm) | 1 |
| T-A6 | Số khớp P6 `.../.../2026` | 1 |
| T-A7 | Tổng khớp `PLACEHOLDER_RE` | 25 |
| T-A8 | Không có placeholder nào nằm trước `<body` | đúng |

Nếu T-A* lệch → dừng và báo người dùng (template đã bị đổi).

## B. Test "giữ nguyên từng byte" (quan trọng nhất)
`fill.js` phải export thêm `replaceTokens(tpl, resolver)` — hàm cấp thấp thực hiện single-pass regex, trong đó `resolver(key)` trả chuỗi thay thế cho `key ∈ {linhVuc, ngheDanh, xungHo, demTen, hoTen, ngay}`. `fill()` chỉ là `replaceTokens` + chuẩn hoá/escape giá trị.

Với mỗi template `tpl`:
1. `marked = replaceTokens(tpl, (key) => '\u0001' + key + '\u0001')` (sentinel `U+0001` không xuất hiện trong template — test phải assert điều này trước).
2. Khôi phục: thay lần lượt mỗi sentinel về đúng chuỗi token gốc theo bảng:
   `linhVuc→[Lĩnh vực]`, `ngheDanh→[Nghệ danh/&nbsp;tên KOLs]`, `xungHo→[Anh/Chị]`, `demTen→[đệm + tên]`, `hoTen→[Họ và tên].` (kèm dấu chấm), `ngay→.../.../2026`.
3. `assert.strictEqual(restored, tpl)` → chứng minh ngoài 25 vị trí, output giống hệt từng byte.
4. Thêm: `assert.strictEqual(marked.split('\u0001').length - 1, 50)` (25 token × 2 sentinel).

## C. Test thay thế đúng giá trị

Input chuẩn (khớp ảnh mẫu của người dùng):
```js
{ type:'kmdh', linhVuc:'Diễn viên', ngheDanh:'Lưu Duy Khánh', xungHo:'anh',
  hoTen:'Nguyễn Hải Anh', demTen:'Hải Anh', ngay:'2026-10-16' }
```
| ID | Kiểm tra (trên output của `kmdh`) |
|---|---|
| T-C1 | Chứa `Thân gửi <strong>Diễn viên Lưu Duy Khánh</strong>,` |
| T-C2 | Chứa `anh&nbsp;Lưu Duy Khánh` **đúng 5 lần** và `Anh&nbsp;Lưu Duy Khánh` **đúng 1 lần** (cặp `[Anh/Chị]&nbsp;[Nghệ danh…]` xuất hiện 6 lần; 1 lần ở đầu đoạn "…thân mến" được viết hoa) |
| T-C3 | Chứa `Em là Hải Anh - Phụ trách Đối ngoại` |
| T-C4 | Chứa `<em>trước ngày 16/10/2026</em>` |
| T-C5 | Chứa `<em>Nguyễn Hải Anh</em>` và **không** chứa `Nguyễn Hải Anh.` |
| T-C6 | `findLeftovers(out)` rỗng |
| T-C7 | Đổi `xungHo:'chị'` → không còn `anh&nbsp;Lưu Duy Khánh` / `Anh&nbsp;Lưu Duy Khánh`; có `chị&nbsp;Lưu Duy Khánh` (5 lần) và `Chị&nbsp;Lưu Duy Khánh` (1 lần) |
| T-C8 | Lặp T-C1…C6 cho `nvtch` và `dsnh` |
| T-C9 | Số token P3 viết hoa trong output **đúng 2** (đếm bằng cách so từng vị trí P3 trong template với output); đó là token thứ 7 và thứ 12 |
| T-C10 | Chứa `<strong>Anh </strong>có thể liên hệ` (đầu câu, viết hoa) và `hy vọng&nbsp;<strong>anh</strong> có thể tới` (giữa câu, thường) |

## D. Test khác biệt giữa 3 template không bị lẫn
| ID | Kiểm tra |
|---|---|
| T-D1 | Output `kmdh` chứa `KHÁCH MỜI ĐỒNG HÀNH` và **không** chứa `NHÂN VẬT TRUYỀN CẢM HỨNG` hay `ĐẠI SỨ NGÀY HỘI` |
| T-D2 | Tương tự cho `nvtch`, `dsnh` |
| T-D3 | Output `kmdh` chứa `1_4uVHJusoJql_udP1bY7ab-nz16W9cQ1`; `nvtch` chứa `1J7UleXoM5ztNxuBo9mEzUMVwz7vt0aKt`; `dsnh` chứa `1AGF15VX4-Hzf-fP4KdEa3mLUIwE8_51v`; mỗi output **không** chứa link của 2 loại kia |
| T-D4 | Output `dsnh` chứa `tòa đa năng, Trường` (có dấu phẩy); `kmdh`/`nvtch` **không** |

## E. Test an toàn dữ liệu
| ID | Input `ngheDanh` | Mong đợi |
|---|---|---|
| T-E1 | `B Ray & Co <3` | output chứa `B Ray &amp; Co &lt;3`, không chứa `<3` thô |
| T-E2 | `Tên "Đặc biệt"` | chứa `&quot;Đặc biệt&quot;` |
| T-E3 | `$& $1 $$` | output chứa đúng chuỗi `$&amp; $1 $$` (tức `$&` được escape `&`→`&amp;`, `$1` và `$$` giữ nguyên) |
| T-E4 | `[Anh/Chị]` (cố tình chèn placeholder) | output vẫn chứa nguyên văn `[Anh/Chị]` ở các vị trí P2 (vì single-pass không quét lại), và `findLeftovers` **phải** báo có sót → UI chặn tải. Test khẳng định hành vi này |
| T-E5 | `Hà   Anh` (nhiều dấu cách) | chuẩn hoá thành `Hà Anh` |

## F. Test hàm phụ
| ID | Hàm | Input → Output |
|---|---|---|
| T-F1 | `deriveDemTen` | `Nguyễn Hải Anh`→`Hải Anh`; `Trần Văn  B`→`Văn B`; `Anh`→`Anh`; ``→`` |
| T-F2 | `formatDate` | `2026-11-15`→`15/11/2026`; `2026-01-05`→`05/01/2026`; ``→`` |
| T-F3 | `slugify` | `Hà Anh Tuấn`→`ha-anh-tuan`; `Đen Vâu`→`den-vau`; `  B Ray & Co! `→`b-ray-co` |
| T-F4 | `validate` | thiếu mỗi trường → có lỗi đúng key; đủ → `ok:true` |

## H. Golden test theo ảnh mẫu của người dùng
Input: `type:'kmdh', linhVuc:'Diễn viên', ngheDanh:'Lưu Duy Khánh', xungHo:'anh', hoTen:'Nguyễn Hải Anh', demTen:'Hải Anh', ngay:'2026-10-16'`.
Text hiển thị (bỏ thẻ HTML, `&nbsp;` → dấu cách) của output phải chứa **nguyên văn** từng câu sau (đây là các câu trong ảnh mẫu):

1. `Thân gửi Diễn viên Lưu Duy Khánh,`
2. `xin gửi lời chúc sức khỏe và lời chào trân trọng nhất đến anh Lưu Duy Khánh.`
3. `Em là Hải Anh - Phụ trách Đối ngoại tại Ngày hội hiến máu Sắc Hồng Hy Vọng lần thứ XXVII`
4. `Thông qua các bài chia sẻ của anh Lưu Duy Khánh, Sắc Hồng Hy Vọng nhận thấy anh là người truyền cảm hứng`
5. `xin đặc biệt gửi lá thư này tới anh với mong muốn mời anh Lưu Duy Khánh trở thành KHÁCH MỜI ĐỒNG HÀNH`
6. `mong anh Lưu Duy Khánh ghé thăm bản Timeline ngày hội`
7. `Anh Lưu Duy Khánh thân mến, sự đồng hành và hỗ trợ của anh sẽ là động lực`
8. `thông qua những thông điệp và hành động ý nghĩa của anh Lưu Duy Khánh, chương trình`
9. `Ban Tổ chức hy vọng anh có thể tới tham dự`
10. `rất mong nhận được hồi âm từ anh Lưu Duy Khánh trước ngày 16/10/2026. Anh có thể liên hệ Ms. Thanh Huyền (0335 401 260)`
11. `Chúc anh có một ngày tốt lành!`
12. dòng ký tên: `Nguyễn Hải Anh` (không có dấu chấm cuối)

Cách so: viết hàm test `visibleText(html)` chỉ dùng regex bỏ `<style>…</style>`, comment, thẻ; đổi `&nbsp;` → ` `; gộp whitespace. (Hàm này chỉ dùng trong test, không đưa vào app.)

## G. Kiểm tra thủ công (checklist cho người dùng, ghi vào docs/06)
- [ ] Mở `app/index.html` bằng double-click, không lỗi Console.
- [ ] Điền thử 1 KOL cho cả 3 loại; mở file tải về, so mắt với template gốc: bố cục/màu/ảnh/nút giống hệt.
- [ ] Bấm 3 nút trong thư (THƯ MỜI / TIMELINE / CÔNG VIỆC VÀ QUYỀN LỢI) mở đúng link Drive.
- [ ] Dán HTML đã sao chép vào công cụ email (Mailchimp/Gmail) nếu cần — không lỗi hiển thị.