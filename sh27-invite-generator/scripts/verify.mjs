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
  for (const [value, lower, cap] of [['con', 'con', 'Con'], ['cháu', 'cháu', 'Cháu']]) {
    test(`T-C12 ${name} tự xưng "${value}"`, 'thay em→' + value + ' giữ hoa/thường, giữ thẻ <em>', () => {
      const out2 = fill.fill(TPL[name], { ...BASE, tuGoi: value });
      assert.ok(out2.includes(cap + ' là Hải Anh - Phụ trách Đối ngoại'), 'sai chỗ "Em là"');
      assert.ok(out2.includes('chúng ' + lower), 'sai chỗ "chúng em"');
      assert.ok(out2.includes('Chúng ' + lower + ' tin rằng'), 'sai chỗ "Chúng em tin"');
      assert.ok(!/(?<![\wÀ-ỹ])[Ee]m(?![\wÀ-ỹ])/.test(out2.replace(/<[^>]*>/g, '')), 'còn sót em/Em ngoài thẻ');
      assert.ok(/<em>/.test(out2), 'mất thẻ <em> in nghiêng');
      assert.ok(out2.includes('<em>Địa điểm:</em>'), 'mất thẻ <em> Địa điểm');
    });
  }
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
// ---- D2. Thư HTTT (qua quản lý) & HTTT-NS (gửi thẳng nghệ sĩ) ----
const HTTT = readFileSync(join(root, 'templates', 'httt.html'), 'utf8');
const HTTT_NS = readFileSync(join(root, 'templates', 'httt-ns.html'), 'utf8');
const HTTT_BASE = {
  type: 'httt', quanLy: 'Quản lý ca sĩ Osad', nntTen: 'Osad',
  xungHoQL: 'anh', xungHoNS: 'chị', tuGoi: 'em', hoTen: 'Nguyễn Hải Anh',
};
const outH = fill.fill(HTTT, HTTT_BASE);
test('T-H1 httt', 'Thân gửi: [Quản lý] nguyên cụm + [XH NS] [Tên NS]', () => {
  assert.ok(outH.includes('Thân gửi <strong>Quản lý ca sĩ Osad</strong> và <strong>Chị Osad</strong>,'));
});
test('T-H2 httt', 'xưng hô QL và NS tách riêng đúng chỗ', () => {
  assert.ok(outH.includes('đến <strong>Anh</strong> đã dành thời gian'), 'xưng hô QL');
  assert.ok(outH.includes('đón tiếp Anh tại ngày hội'), 'xưng hô QL giữa câu');
  assert.ok(outH.includes('của <strong>Chị Osad</strong> và rất tiếc'), 'xưng hô NS');
  assert.ok(outH.includes('<strong>Anh và Chị Osad</strong> có thể đồng hành'), 'cặp QL+NS');
  assert.ok(!/(?<![\wÀ-ỹ])anh(?![\wÀ-ỹ])/.test(outH.replace(/<[^>]*>/g, '')), 'còn "anh" thường');
});
test('T-H3 httt', 'tên NS điền đủ các chỗ in đậm', () => {
  assert.strictEqual(countMatches(outH, /<strong>Chị Osad<\/strong>/g), 3);
  assert.strictEqual(countMatches(outH, /<strong>Anh và Chị Osad<\/strong>/g), 3);
  assert.ok(outH.includes('<strong>Hỗ Trợ Truyền Thông</strong>'));
});
test('T-H4 httt', 'tự xưng em giữ nguyên + chữ ký, không sót placeholder', () => {
  assert.ok(outH.includes('em xin gửi lời cảm ơn'));
  assert.ok(outH.includes('Chúng em hoàn toàn thấu hiểu'));
  assert.ok(outH.includes('Em xin cảm ơn'));
  assert.ok(outH.includes('<em>Nguyễn Hải Anh</em>'));
  assert.deepStrictEqual(fill.findLeftovers(outH), []);
});
test('T-H5 httt', 'tự xưng con thay đúng hoa/thường', () => {
  const out2 = fill.fill(HTTT, { ...HTTT_BASE, tuGoi: 'con' });
  assert.ok(out2.includes('con xin gửi lời cảm ơn'));
  assert.ok(out2.includes('Chúng con hoàn toàn thấu hiểu'));
  assert.ok(out2.includes('Con xin cảm ơn'));
  assert.ok(!/(?<![\wÀ-ỹ])[Ee]m(?![\wÀ-ỹ])/.test(out2.replace(/<[^>]*>/g, '')), 'còn sót em/Em ngoài thẻ');
});
test('T-H6 httt', 'đổi xưng hô QL thành Chị: chỉ chỗ QL đổi', () => {
  const out2 = fill.fill(HTTT, { ...HTTT_BASE, xungHoQL: 'chị' });
  assert.ok(out2.includes('đến <strong>Chị</strong> đã dành'));
  assert.ok(out2.includes('<strong>Chị và Chị Osad</strong> có thể đồng hành'));
  assert.ok(out2.includes('<em>Nguyễn Hải Anh</em>'));
});
test('T-H7 httt', 'validate httt: cần quanLy+nntTen+hoTen, không cần demTen/ngay/linhVuc', () => {
  const r1 = fill.validate({ type: 'httt', nntTen: 'a', hoTen: 'b' });
  assert.ok(!r1.ok && r1.errors.quanLy && !r1.errors.demTen && !r1.errors.ngay && !r1.errors.linhVuc);
  const r2 = fill.validate({ type: 'httt', quanLy: 'q', nntTen: 'a', hoTen: 'b' });
  assert.ok(r2.ok);
});
test('T-H8 httt', 'validate kmdh không đổi: vẫn cần demTen+ngay', () => {
  const r = fill.validate({ type: 'kmdh', linhVuc: 'a', ngheDanh: 'b', hoTen: 'c' });
  assert.ok(!r.ok && r.errors.demTen && r.errors.ngay && !r.errors.nntTen);
});

// ---- HTTT-NS: cùng thư nhưng gửi thẳng nghệ sĩ, không có quản lý ----
const HTTT_NS_BASE = { type: 'httt-ns', nntTen: 'Osad', xungHoNS: 'chị', tuGoi: 'em', hoTen: 'Nguyễn Hải Anh' };
const outN = fill.fill(HTTT_NS, HTTT_NS_BASE);
test('T-H9 httt-ns', 'Thân gửi thẳng nghệ sĩ, không còn chữ "Quản lý"', () => {
  assert.ok(outN.includes('Thân gửi <strong>Chị Osad</strong>,'));
  assert.ok(!outN.includes('Quản lý'), 'vẫn còn nhắc quản lý');
  assert.deepStrictEqual(fill.findLeftovers(outN), []);
});
test('T-H10 httt-ns', 'các chỗ xưng hô + chữ ký đúng', () => {
  assert.ok(outN.includes('đến <strong>Chị</strong> đã dành thời gian'));
  assert.ok(outN.includes('của <strong>Chị</strong> và rất tiếc'));
  assert.ok(outN.includes('<strong>Chị</strong> có thể đồng hành cùng chương trình'));
  assert.ok(outN.includes('từ phía <strong>Chị</strong>!'));
  assert.ok(outN.includes('<em>Nguyễn Hải Anh</em>'));
});
test('T-H11 httt-ns', 'validate httt-ns: chỉ cần nntTen+hoTen', () => {
  const r1 = fill.validate({ type: 'httt-ns', nntTen: 'a' });
  assert.ok(!r1.ok && r1.errors.hoTen && !r1.errors.quanLy && !r1.errors.linhVuc);
  const r2 = fill.validate({ type: 'httt-ns', nntTen: 'a', hoTen: 'b' });
  assert.ok(r2.ok);
});

// ---- CAM-ON: Thư chỉ cảm ơn KOL/KOC ----
const CAM_ON = readFileSync(join(root, 'templates', 'cam-on.html'), 'utf8');
const CAM_ON_BASE = {
  type: 'cam-on',
  linhVuc: 'Content Creator',
  nntTen: 'Tun Phạm',
  xungHoNS: 'anh',
  tuGoi: 'em',
  hoTen: 'Vũ Thái Tuấn',
};
const outC = fill.fill(CAM_ON, CAM_ON_BASE);
test('T-CO1 cam-on', 'Điền đúng các placeholder và in đậm', () => {
  assert.ok(outC.includes('Dear <strong>Content Creator Tun Phạm và Team</strong>,'));
  assert.ok(outC.includes('cảm ơn <strong>Anh Tun Phạm</strong> cùng <strong>Team</strong>'));
  assert.ok(outC.includes('đồng hành cùng <strong>Anh Tun Phạm</strong> trong các'));
  assert.ok(outC.includes('kính chúc <strong>Anh</strong> nhiều sức khỏe'));
  assert.ok(outC.includes('<strong>Trân trọng,</strong>'));
  assert.ok(outC.includes('<em>Vũ Thái Tuấn</em>'));
  assert.deepStrictEqual(fill.findLeftovers(outC), []);
});
test('T-CO2 cam-on', 'Đổi xưng hô sang Chị', () => {
  const outChi = fill.fill(CAM_ON, { ...CAM_ON_BASE, xungHoNS: 'chị' });
  assert.ok(outChi.includes('cảm ơn <strong>Chị Tun Phạm</strong>'));
  assert.ok(outChi.includes('kính chúc <strong>Chị</strong> nhiều sức khỏe'));
});
test('T-CO3 cam-on', 'validate cam-on: cần linhVuc + nntTen + hoTen', () => {
  const r1 = fill.validate({ type: 'cam-on', nntTen: 'Tun', hoTen: 'Vũ' });
  assert.ok(!r1.ok && r1.errors.linhVuc);
  const r2 = fill.validate(CAM_ON_BASE);
  assert.ok(r2.ok);
});

// ---- D. Khác biệt 3 template (bản gốc) ----
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

// ---- NTT: Thư mời Nhà tài trợ ----
const NTT = readFileSync(join(root, 'templates', 'ntt.html'), 'utf8');
const NTT_BASE = {
  type: 'ntt',
  nhaTaiTro: 'Công ty TNHH ABC',
  demTen: 'Hải Anh',
  ngay: '2026-11-15',
  hoTen: 'Nguyễn Hải Anh',
};
const outNTT = fill.fill(NTT, NTT_BASE);
test('T-NTT1 ntt', 'Kính gửi [Nhà tài trợ] đúng tên', () => {
  assert.ok(outNTT.includes('<strong>Công ty TNHH ABC</strong>'));
  assert.ok(outNTT.includes('Kính gửi'));
});
test('T-NTT2 ntt', 'Mình là [đệm + tên] đúng', () => {
  assert.ok(outNTT.includes('Mình là Hải Anh'));
});
test('T-NTT3 ntt', 'Ngày hồi âm đúng', () => {
  assert.ok(outNTT.includes('trước ngày 15/11/2026'));
});
test('T-NTT4 ntt', 'Ký tên đúng, không dấu chấm', () => {
  assert.ok(outNTT.includes('<em>Nguyễn Hải Anh</em>'));
  assert.ok(!outNTT.includes('Nguyễn Hải Anh.'));
});
test('T-NTT5 ntt', 'Không sót placeholder', () => {
  assert.deepStrictEqual(fill.findLeftovers(outNTT), []);
});
test('T-NTT6 ntt', 'validate ntt: cần nhaTaiTro + demTen + ngay + hoTen', () => {
  const r1 = fill.validate({ type: 'ntt', demTen: 'a', ngay: '2026-01-01', hoTen: 'b' });
  assert.ok(!r1.ok && r1.errors.nhaTaiTro, 'thiếu nhaTaiTro vẫn ok');
  const r2 = fill.validate(NTT_BASE);
  assert.ok(r2.ok);
});

// ---- BTTT: Thư mời Bảo trợ truyền thông ----
const BTTT = readFileSync(join(root, 'templates', 'bttt.html'), 'utf8');
const BTTT_BASE = {
  type: 'bttt',
  donViBttt: 'Báo Thanh Niên',
  demTen: 'Hải Anh',
  ngay: '2026-11-15',
  hoTen: 'Nguyễn Hải Anh',
};
const outBTTT = fill.fill(BTTT, BTTT_BASE);
test('T-BTTT1 bttt', 'Kính gửi [Đơn vị BTTT] đúng tên', () => {
  assert.ok(outBTTT.includes('Kính gửi <strong>Báo Thanh Niên</strong>,'));
});
test('T-BTTT2 bttt', 'Mình là [đệm + tên] đúng', () => {
  assert.ok(outBTTT.includes('Mình là Hải Anh'));
});
test('T-BTTT3 bttt', 'Ngày hồi âm đúng', () => {
  assert.ok(outBTTT.includes('trước ngày 15/11/2026'));
});
test('T-BTTT4 bttt', 'Ký tên đúng, không dấu chấm', () => {
  assert.ok(outBTTT.includes('<em>Nguyễn Hải Anh</em>'));
  assert.ok(!outBTTT.includes('Nguyễn Hải Anh.'));
});
test('T-BTTT5 bttt', 'Không sót placeholder', () => {
  assert.deepStrictEqual(fill.findLeftovers(outBTTT), []);
});
test('T-BTTT6 bttt', 'validate bttt: cần donViBttt + demTen + ngay + hoTen', () => {
  const r1 = fill.validate({ type: 'bttt', demTen: 'a', ngay: '2026-01-01', hoTen: 'b' });
  assert.ok(!r1.ok && r1.errors.donViBttt, 'thiếu donViBttt vẫn ok');
  const r2 = fill.validate(BTTT_BASE);
  assert.ok(r2.ok);
});

console.log(`\nKết quả: ${passed} PASS, ${failed} FAIL`);
process.exit(failed ? 1 : 0);
