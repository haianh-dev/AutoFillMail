/* SH27 — lõi điền placeholder. Hàm thuần, không đụng DOM, chạy được cả browser lẫn Node. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SH27Fill = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Regex gộp single-pass (docs/03 §3): P5 gồm cả dấu chấm đi kèm (\.?); P2 chấp nhận &nbsp;, khoảng trắng hoặc không gì giữa "/" và "tên KOLs"
  var PLACEHOLDER_RE =
    /\[Lĩnh vực\]|\[Nghệ danh\/(?:&nbsp;|\s)?tên KOLs\]|\[Anh\/Chị\]|\[Quản lý\]|\[XH QL\]|\[XH NS\]|\[Tên NS\]|\[Đơn vị BTTT\]|\[Nhà tài trợ\]|\[đệm \+ tên\]|\[Họ và tên\]\.?|\.\.\.\/\.\.\.\/2026/g;

  var KEY_BY_PREFIX = [
    ['[Lĩnh', 'linhVuc'],
    ['[Nghệ', 'ngheDanh'],
    ['[Anh/Chị]', 'xungHo'],
    ['[Quản lý]', 'quanLy'],
    ['[XH QL]', 'xungHoQL'],
    ['[XH NS]', 'xungHoNS'],
    ['[Tên NS]', 'nntTen'],
    ['[Đơn vị BTTT]', 'donViBttt'],
    ['[Nhà tài trợ]', 'nhaTaiTro'],
    ['[đệm', 'demTen'],
    ['[Họ', 'hoTen'],
    ['...', 'ngay'],
  ];

  // Pattern kiểm tra placeholder còn sót (docs/03 §3)
  var LEFTOVER_BRACKET_RE = /\[(?:Lĩnh vực|Nghệ danh|Anh\/Chị|Quản lý|XH QL|XH NS|Tên NS|Đơn vị BTTT|Nhà tài trợ|đệm|Họ và tên)[^\]]*\]/;
  var LEFTOVER_DATE_RE = /\.\.\.\/\.\.\.\/2026/;

  // docs/03 §4.2: ngay trước token (bỏ qua khoảng trắng, &nbsp;, thẻ strong/em/span/b/i)
  // là dấu kết câu . ! ? hoặc thẻ mở <p …> → token đứng đầu câu, viết hoa
  var SENTENCE_START_RE =
    /(?:[.!?]|<p\b[^>]*>)(?:\s|&nbsp;|<\/?(?:strong|em|span|b|i)\b[^>]*>)*$/;

  function isSentenceStart(before) {
    return SENTENCE_START_RE.test(before);
  }

  function normalizeText(s) {
    return String(s == null ? '' : s).trim().replace(/\s+/g, ' ');
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function deriveDemTen(hoTen) {
    var words = normalizeText(hoTen).split(' ').filter(Boolean);
    if (words.length === 0) return '';
    if (words.length === 1) return words[0];
    return words[words.length - 2] + ' ' + words[words.length - 1];
  }

  function formatDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso == null ? '' : iso).trim());
    if (!m) return '';
    return m[3] + '/' + m[2] + '/' + m[1];
  }

  function slugify(s) {
    return normalizeText(s)
      .replace(/đ/g, 'd').replace(/Đ/g, 'D')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  var LABELS = {
    linhVuc: 'lĩnh vực',
    ngheDanh: 'nghệ danh / tên KOL',
    hoTen: 'họ và tên của bạn',
    demTen: 'đệm + tên của bạn',
    ngay: 'ngày hồi âm',
    nntTen: 'tên nghệ sĩ / người nổi tiếng',
    quanLy: 'tên người quản lý',
    nhaTaiTro: 'tên nhà tài trợ',
    donViBttt: 'tên đơn vị bảo trợ truyền thông',
  };

  // Thư HTTT & Cảm ơn không có [đệm + tên], [ngày], [Nghệ danh] — cần chỗ khác tùy bản thư
  var REQUIRED_BY_TYPE = {
    httt: ['quanLy', 'nntTen', 'hoTen'],
    'httt-ns': ['nntTen', 'hoTen'],
    'cam-on': ['linhVuc', 'nntTen', 'hoTen'],
    ntt: ['nhaTaiTro', 'demTen', 'ngay', 'hoTen'],
    bttt: ['donViBttt', 'demTen', 'ngay', 'hoTen'],
  };

  function validate(values) {
    var v = values || {};
    var errors = {};
    var req = REQUIRED_BY_TYPE[v.type] || ['linhVuc', 'ngheDanh', 'hoTen', 'demTen', 'ngay'];
    req.forEach(function (k) {
      if (!normalizeText(v[k])) errors[k] = 'Vui lòng nhập ' + LABELS[k] + '.';
    });
    if (req.indexOf('ngay') !== -1 && (!v.ngay || !formatDate(v.ngay))) {
      errors.ngay = 'Vui lòng chọn ngày hồi âm.';
    }
    return { ok: Object.keys(errors).length === 0, errors: errors };
  }

  // Cấp thấp: single-pass regex trên template GỐC; resolver(key, ctx) với
  // ctx.before = tối đa 200 ký tự gốc của template ngay trước token (docs/04 §4)
  function replaceTokens(tpl, resolver) {
    return String(tpl).replace(PLACEHOLDER_RE, function (m) {
      var offset = arguments[arguments.length - 2];
      var before = String(tpl).slice(Math.max(0, offset - 200), offset);
      for (var i = 0; i < KEY_BY_PREFIX.length; i++) {
        if (m.indexOf(KEY_BY_PREFIX[i][0]) === 0) return resolver(KEY_BY_PREFIX[i][1], { before: before });
      }
      return m;
    });
  }

  function capFirst(w) {
    return w.charAt(0).toUpperCase() + w.slice(1);
  }

  // Tự xưng: thay từ "em"/"Em" trong template bằng "con"/"cháu" (giữ hoa/thường
  // theo vị trí gốc). Chỉ thay trong đoạn text ngoài thẻ HTML để không đụng <em>
  // (in nghiêng); ranh giới từ dùng \w + khoảng À-ỹ để không khớp "xem", "email"…
  var EM_TOKEN_RE = /(^|[^\w\u00C0-\u1EF9])([Ee]m)(?![\w\u00C0-\u1EF9])/g;
  function replaceSelfRef(tpl, word) {
    return String(tpl).split(/(<[^>]*>)/).map(function (seg) {
      if (seg.charAt(0) === '<') return seg;
      var cap = capFirst(word);
      return seg.replace(EM_TOKEN_RE, function (m, pre, tok) {
        return pre + (tok === 'Em' ? cap : word);
      });
    }).join('');
  }

  function fill(templateHtml, values) {
    var v = values || {};
    var XUNG_HO_BY_VALUE = {
      anh: 'Anh',
      chị: 'Chị',
      cô: 'Cô',
      chú: 'Chú',
      'anh chị': 'Anh Chị',
      band: 'Band',
    };
    var xung = XUNG_HO_BY_VALUE[v.xungHo] || 'Anh';
    // Tự xưng thay cho "em": chỉ con/cháu cần thay; 'em' giữ nguyên template
    var tpl = (v.tuGoi === 'con' || v.tuGoi === 'cháu')
      ? replaceSelfRef(templateHtml, v.tuGoi)
      : templateHtml;
    var val = {
      linhVuc: escapeHtml(normalizeText(v.linhVuc)),
      ngheDanh: escapeHtml(normalizeText(v.ngheDanh)),
      quanLy: escapeHtml(normalizeText(v.quanLy)),
      nntTen: escapeHtml(normalizeText(v.nntTen)),
      nhaTaiTro: escapeHtml(normalizeText(v.nhaTaiTro)),
      donViBttt: escapeHtml(normalizeText(v.donViBttt)),
      demTen: escapeHtml(normalizeText(v.demTen)),
      hoTen: escapeHtml(normalizeText(v.hoTen)),
      ngay: formatDate(v.ngay),
    };
    return replaceTokens(tpl, function (key, ctx) {
      if (key === 'xungHo') {
        // Yêu cầu mới của sếp: viết hoa "Anh"/"Chị" ở MỌI vị trí (không còn case thường)
        return capFirst(xung);
      }
      if (key === 'xungHoQL') return XUNG_HO_BY_VALUE[v.xungHoQL] || 'Anh';
      if (key === 'xungHoNS') return XUNG_HO_BY_VALUE[v.xungHoNS] || 'Anh';
      return val[key];
    });
  }

  function findLeftovers(html) {
    var out = [];
    var m;
    var re1 = new RegExp(LEFTOVER_BRACKET_RE.source, 'g');
    while ((m = re1.exec(html)) !== null) out.push(m[0]);
    var re2 = new RegExp(LEFTOVER_DATE_RE.source, 'g');
    while ((m = re2.exec(html)) !== null) out.push(m[0]);
    return out;
  }

  var SUBJECT_TEMPLATES = {
    kmdh: function (v) {
      var lv = normalizeText(v.linhVuc);
      var nd = normalizeText(v.ngheDanh);
      return (lv && nd) ? 'Sắc Hồng Hy Vọng XXVII | Thư mời Khách mời đồng hành | ' + lv + ' ' + nd : '';
    },
    nvtch: function (v) {
      var lv = normalizeText(v.linhVuc);
      var nd = normalizeText(v.ngheDanh);
      return (lv && nd) ? 'Sắc Hồng Hy Vọng XXVII | Thư mời Nhân vật truyền cảm hứng | ' + lv + ' ' + nd : '';
    },
    dsnh: function (v) {
      var lv = normalizeText(v.linhVuc);
      var nd = normalizeText(v.ngheDanh);
      return (lv && nd) ? 'Sắc Hồng Hy Vọng XXVII | Thư mời Đại sứ ngày hội | ' + lv + ' ' + nd : '';
    },
    bttt: function (v) {
      var dv = normalizeText(v.donViBttt);
      return dv ? 'Sắc Hồng Hy Vọng XXVII | Thư mời Hợp tác Bảo trợ truyền thông | ' + dv : '';
    },
    ntt: function (v) {
      var ntt = normalizeText(v.nhaTaiTro);
      return ntt ? 'Sắc Hồng Hy Vọng XXVII | Thư mời Hợp tác Tài trợ | ' + ntt : '';
    },
  };

  function buildSubject(type, data) {
    var fn = SUBJECT_TEMPLATES[type];
    return fn ? fn(data || {}) : '';
  }

  return {
    PLACEHOLDER_RE: PLACEHOLDER_RE,
    normalizeText: normalizeText,
    escapeHtml: escapeHtml,
    deriveDemTen: deriveDemTen,
    formatDate: formatDate,
    slugify: slugify,
    validate: validate,
    isSentenceStart: isSentenceStart,
    replaceTokens: replaceTokens,
    replaceSelfRef: replaceSelfRef,
    fill: fill,
    findLeftovers: findLeftovers,
    buildSubject: buildSubject,
  };
});
