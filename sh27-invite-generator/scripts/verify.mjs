/* verify.mjs — chạy toàn bộ test docs/05 (nhóm A, B, C, D, E, F, H). Thoát mã ≠ 0 nếu có FAIL. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fill = require(join(root, 'app', 'fill.js'));

const TPL = {
  kmdh: readFileSync(join(root, 'templates', 'kmdh.html'), 'utf8'),
  nvtch: readFileSync(join(root, 'templates', 'nvtch.html'), 'utf8'),
  dsnh: readFileSync(join(root, 'templates', 'dsnh.html'), 'utf8'),
};

let passed = 0, failed = 0;
function test(id, name, fn) {
  try {
    fn();
    passed++;
    console.log(`PASS  ${id}  ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL  ${id}  ${name}\n      ${e.message}`);
  }
}

function countMatches(hay, re) {
  const r = new RegExp(re.source, 'g');
  let n = 0;
  while (r.exec(hay) !== null) n++;
  return n;
}

const P = {
  p1: /\[Lĩnh vực\]/,
  p2: /\[Nghệ danh\/(?:&nbsp;|\s)?tên KOLs\]/,
  p3: /\[Anh\/Chị\]/,
  p4: /\[đệm \+ tên\]/,
  p5: /\[Họ và tên\]\./,
  p6: /\.\.\.\/\.\.\.\/2026/,
};

// ---- A. Cấu trúc template ----
for (const [name, tpl] of Object.entries(TPL)) {
  const TAG = `A/${name}`;
  test(`T-A1 ${TAG}`, 'P1 ×1', () => assert.strictEqual(countMatches(tpl, P.p1), 1));
  test(`T-A2 ${TAG}`, 'P2 ×8', () => assert.strictEqual(countMatches(tpl, P.p2), 8));
  test(`T-A3 ${TAG}`, 'P3 ×13', () => assert.strictEqual(countMatches(tpl, P.p3), 13));
  test(`T-A4 ${TAG}`, 'P4 ×1', () => assert.strictEqual(countMatches(tpl, P.p4), 1));
  test(`T-A5 ${TAG}`, 'P5 (kèm dấu chấm) ×1', () => assert.strictEqual(countMatches(tpl, P.p5), 1));
  test(`T-A6 ${TAG}`, 'P6 ×1', () => assert.strictEqual(countMatches(tpl, P.p6), 1));
  test(`T-A7 ${TAG}`, 'tổng 25', () => {
    const r = new RegExp(fill.PLACEHOLDER_RE.source, 'g');
    let n = 0;
    while (r.exec(tpl) !== null) n++;
    assert.strictEqual(n, 25);
  });
  test(`T-A8 ${TAG}`, 'không placeholder trước <body', () => {
    const headEnd = tpl.indexOf('<body');
    assert.ok(headEnd !== -1, 'thiếu <body>');
    const head = tpl.slice(0, headEnd);
    for (const re of Object.values(P)) assert.strictEqual(countMatches(head, re), 0);
  });
}

// ---- B. Giữ nguyên từng byte ----
const TOKEN_BY_KEY = {
  linhVuc: '[Lĩnh vực]',
  ngheDanh: '[Nghệ danh/&nbsp;tên KOLs]',
  xungHo: '[Anh/Chị]',
  demTen: '[đệm + tên]',
  hoTen: '[Họ và tên].', // P5 gồm cả dấu chấm đi kèm
  ngay: '.../.../2026',
};
for (const [name, tpl] of Object.entries(TPL)) {
  test(`T-B ${name}`, 'byte-identical sau khôi phục', () => {
    assert.ok(!tpl.includes('\u0001'), 'template chứa sentinel U+0001');
    const marked = fill.replaceTokens(tpl, (key) => '\u0001' + key + '\u0001');
    assert.strictEqual(marked.split('\u0001').length - 1, 50, 'số sentinel ≠ 50');
    let restored = marked;
    for (const [key, token] of Object.entries(TOKEN_BY_KEY)) {
      restored = restored.split('\u0001' + key + '\u0001').join(token);
    }
    assert.strictEqual(restored, tpl);
  });
}

// ---- C. Thay thế đúng giá trị (input khớp ảnh mẫu của người dùng) ----
const BASE = {
  type: 'kmdh', linhVuc: 'Diễn viên', ngheDanh: 'Lưu Duy Khánh', xungHo: 'anh',
  hoTen: 'Nguyễn Hải Anh', demTen: 'Hải Anh', ngay: '2026-10-16',
};
for (const name of Object.keys(TPL)) {
  const out = fill.fill(TPL[name], { ...BASE, type: name });
  test(`T-C1 ${name}`, 'Thân gửi đúng', () =>
    assert.ok(out.includes('Thân gửi <strong>Diễn viên Lưu Duy Khánh</strong>,')));
  test(`T-C2 ${name}`, 'Anh&nbsp;Lưu Duy Khánh ×6 (viết hoa mọi vị trí)', () => {
    assert.strictEqual(countMatches(out, /Anh&nbsp;Lưu Duy Khánh/), 6);
    assert.strictEqual(countMatches(out, /anh&nbsp;Lưu Duy Khánh/), 0);
  });
  test(`T-C3 ${name}`, 'Em là Hải Anh', () =>
    assert.ok(out.includes('Em là Hải Anh - Phụ trách Đối ngoại')));
  test(`T-C4 ${name}`, 'ngày 16/10/2026', () =>
    assert.ok(out.includes('<em>trước ngày 16/10/2026</em>')));
  test(`T-C5 ${name}`, 'ký tên không có dấu chấm', () => {
    assert.ok(out.includes('<em>Nguyễn Hải Anh</em>'));
    assert.ok(!out.includes('Nguyễn Hải Anh.'), 'còn dấu chấm sau tên');
  });
  test(`T-C6 ${name}`, 'không sót placeholder', () =>
    assert.deepStrictEqual(fill.findLeftovers(out), []));
  test(`T-C7 ${name}`, 'xưng hô chị: viết hoa mọi vị trí', () => {
    const out2 = fill.fill(TPL[name], { ...BASE, xungHo: 'chị' });
    assert.ok(!out2.includes('anh&nbsp;Lưu Duy Khánh'));
    assert.ok(!out2.includes('Anh&nbsp;Lưu Duy Khánh'));
    assert.strictEqual(countMatches(out2, /Chị&nbsp;Lưu Duy Khánh/), 6);
    assert.ok(!out2.includes('Anh&nbsp;'), 'còn Anh&nbsp; khi chọn chị');
  });
  test(`T-C9 ${name}`, 'không còn "anh"/"chị" viết thường nào từ token P3', () => {
    // 13 token P3 đều viết hoa; kiểm tra output không còn "anh </strong>" / "hy vọng&nbsp;<strong>anh"
    assert.ok(!out.includes('hy vọng&nbsp;<strong>anh</strong>'));
    assert.ok(!/<strong>anh <\/strong>/.test(out));
  });
  test(`T-C10 ${name}`, 'viết hoa đầu câu và giữa câu', () => {
    assert.ok(out.includes('<strong>Anh </strong>có thể liên hệ'));
    assert.ok(out.includes('hy vọng&nbsp;<strong>Anh</strong> có thể tới'));
  });
  for (const [value, word] of [['cô', 'Cô'], ['chú', 'Chú'], ['anh chị', 'Anh Chị'], ['band', 'Band']]) {
    test(`T-C11 ${name} xưng hô "${value}"`, `viết hoa ${word} mọi vị trí (×6)`, () => {
      const out2 = fill.fill(TPL[name], { ...BASE, xungHo: value });
      assert.strictEqual(countMatches(out2, new RegExp(word + '&nbsp;Lưu Duy Khánh', 'g')), 6);
      assert.ok(!out2.includes('Anh&nbsp;Lưu Duy Khánh'), 'còn xưng hô cũ');
    });
  }
}

// ---- D. Khác biệt 3 template ----
const ROLE = {
  kmdh: 'KHÁCH MỜI ĐỒNG HÀNH',
  nvtch: 'NHÂN VẬT TRUYỀN CẢM HỨNG',
  dsnh: 'ĐẠI SỨ NGÀY HỘI',
};
const DRIVE = {
  kmdh: '1_4uVHJusoJql_udP1bY7ab-nz16W9cQ1',
  nvtch: '1J7UleXoM5ztNxuBo9mEzUMVwz7vt0aKt',
  dsnh: '1AGF15VX4-Hzf-fP4KdEa3mLUIwE8_51v',
};
for (const name of Object.keys(TPL)) {
  const out = fill.fill(TPL[name], BASE);
  test(`T-D1/D2 ${name}`, 'đúng vai trò, không lẫn vai trò khác', () => {
    assert.ok(out.includes(ROLE[name]));
    for (const other of Object.keys(ROLE)) {
      if (other !== name) assert.ok(!out.includes(ROLE[other]), `lẫn vai trò ${other}`);
    }
  });
  test(`T-D3 ${name}`, 'đúng link Drive, không lẫn link', () => {
    assert.ok(out.includes(DRIVE[name]));
    for (const other of Object.keys(DRIVE)) {
      if (other !== name) assert.ok(!out.includes(DRIVE[other]), `lẫn link ${other}`);
    }
  });
}
test('T-D4', 'dsnh có dấu phẩy "tòa đa năng, Trường", 2 file kia không', () => {
  const outs = Object.fromEntries(Object.keys(TPL).map((n) => [n, fill.fill(TPL[n], BASE)]));
  assert.ok(outs.dsnh.includes('tòa đa năng, Trường'));
  assert.ok(!outs.kmdh.includes('tòa đa năng, Trường'));
  assert.ok(!outs.nvtch.includes('tòa đa năng, Trường'));
});

// ---- E. An toàn dữ liệu ----
test('T-E1', 'escape <3 và &', () => {
  const out = fill.fill(TPL.kmdh, { ...BASE, ngheDanh: 'B Ray & Co <3' });
  assert.ok(out.includes('B Ray &amp; Co &lt;3'));
  assert.ok(!out.includes('<3'));
});
test('T-E2', 'escape dấu nháy kép', () => {
  const out = fill.fill(TPL.kmdh, { ...BASE, ngheDanh: 'Tên "Đặc biệt"' });
  assert.ok(out.includes('&quot;Đặc biệt&quot;'));
});
test('T-E3', '$& $1 $$ không bị JS diễn giải', () => {
  const out = fill.fill(TPL.kmdh, { ...BASE, ngheDanh: '$& $1 $$' });
  assert.ok(out.includes('$&amp; $1 $$'));
});
test('T-E4', 'chèn placeholder → single-pass giữ nguyên + findLeftovers báo sót', () => {
  const out = fill.fill(TPL.kmdh, { ...BASE, ngheDanh: '[Anh/Chị]' });
  assert.ok(out.includes('[Anh/Chị]'));
  assert.ok(fill.findLeftovers(out).length > 0);
});
test('T-E5', 'gộp nhiều dấu cách', () => {
  const out = fill.fill(TPL.kmdh, { ...BASE, ngheDanh: 'Hà   Anh' });
  assert.ok(out.includes('Hà Anh') && !out.includes('Hà   Anh'));
});

// ---- F. Hàm phụ ----
test('T-F1', 'deriveDemTen', () => {
  assert.strictEqual(fill.deriveDemTen('Nguyễn Hải Anh'), 'Hải Anh');
  assert.strictEqual(fill.deriveDemTen('Trần Văn  B'), 'Văn B');
  assert.strictEqual(fill.deriveDemTen('Anh'), 'Anh');
  assert.strictEqual(fill.deriveDemTen(''), '');
});
test('T-F2', 'formatDate', () => {
  assert.strictEqual(fill.formatDate('2026-11-15'), '15/11/2026');
  assert.strictEqual(fill.formatDate('2026-01-05'), '05/01/2026');
  assert.strictEqual(fill.formatDate(''), '');
});
test('T-F3', 'slugify', () => {
  assert.strictEqual(fill.slugify('Hà Anh Tuấn'), 'ha-anh-tuan');
  assert.strictEqual(fill.slugify('Đen Vâu'), 'den-vau');
  assert.strictEqual(fill.slugify('  B Ray & Co! '), 'b-ray-co');
});
test('T-F4', 'validate', () => {
  for (const key of ['linhVuc', 'ngheDanh', 'hoTen', 'demTen', 'ngay']) {
    const v = { ...BASE, [key]: '' };
    const r = fill.validate(v);
    assert.strictEqual(r.ok, false, `thiếu ${key} vẫn ok`);
    assert.ok(r.errors[key], `thiếu ${key} không có lỗi đúng key`);
  }
  assert.strictEqual(fill.validate(BASE).ok, true);
});

// ---- H. Golden test theo ảnh mẫu ----
function visibleText(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+([.,!?;:])/g, '$1') // dấu câu thường nằm trong ô bảng riêng → bỏ khoảng trắng đọng trước nó
    .replace(/\s+/g, ' ');
}

const GOLDEN_OUT = fill.fill(TPL.kmdh, BASE);
const GOLDEN_TEXT = visibleText(GOLDEN_OUT);
const GOLDEN_SENTENCES = [
  'Thân gửi Diễn viên Lưu Duy Khánh,',
  'xin gửi lời chúc sức khỏe và lời chào trân trọng nhất đến Anh Lưu Duy Khánh.',
  'Em là Hải Anh - Phụ trách Đối ngoại tại Ngày hội hiến máu Sắc Hồng Hy Vọng lần thứ XXVII',
  'Thông qua các bài chia sẻ của Anh Lưu Duy Khánh, Sắc Hồng Hy Vọng nhận thấy Anh là người truyền cảm hứng',
  'xin đặc biệt gửi lá thư này tới Anh với mong muốn mời Anh Lưu Duy Khánh trở thành KHÁCH MỜI ĐỒNG HÀNH',
  'mong Anh Lưu Duy Khánh ghé thăm bản Timeline ngày hội',
  'Anh Lưu Duy Khánh thân mến, sự đồng hành và hỗ trợ của Anh sẽ là động lực',
  'thông qua những thông điệp và hành động ý nghĩa của Anh Lưu Duy Khánh, chương trình',
  'Ban Tổ chức hy vọng Anh có thể tới tham dự',
  'rất mong nhận được hồi âm từ Anh Lưu Duy Khánh trước ngày 16/10/2026. Anh có thể liên hệ Ms. Thanh Huyền (0335 401 260)',
  'Chúc Anh có một ngày tốt lành!',
  'Nguyễn Hải Anh', // dòng ký tên, không có dấu chấm cuối
];
GOLDEN_SENTENCES.forEach((sentence, i) => {
  test(`T-H${i + 1}`, 'câu mẫu nguyên văn', () => {
    assert.ok(GOLDEN_TEXT.includes(sentence), 'không tìm thấy: ' + sentence);
  });
});
test('T-H12b', 'dòng ký tên không có dấu chấm', () => {
  assert.ok(!GOLDEN_TEXT.includes('Nguyễn Hải Anh.'), 'ký tên còn dấu chấm');
});

console.log(`\nKết quả: ${passed} PASS, ${failed} FAIL`);
process.exit(failed ? 1 : 0);
