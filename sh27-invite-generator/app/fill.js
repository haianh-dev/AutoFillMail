/* SH27 — lõi điền placeholder. Hàm thuần, không đụng DOM, chạy được cả browser lẫn Node. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SH27Fill = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Regex gộp single-pass (docs/03 §3): P5 gồm cả dấu chấm đi kèm (\.?); P2 chấp nhận &nbsp;, khoảng trắng hoặc không gì giữa "/" và "tên KOLs"
  var PLACEHOLDER_RE =
    /\[Lĩnh vực\]|\[Nghệ danh\/(?:&nbsp;|\s)?tên KOLs\]|\[Anh\/Chị\]|\[đệm \+ tên\]|\[Họ và tên\]\.?|\.\.\.\/\.\.\.\/2026/g;

  var KEY_BY_PREFIX = [
    ['[Lĩnh', 'linhVuc'],
    ['[Nghệ', 'ngheDanh'],
    ['[Anh/Chị]', 'xungHo'],
    ['[đệm', 'demTen'],
    ['[Họ', 'hoTen'],
    ['...', 'ngay'],
  ];

  // Pattern kiểm tra placeholder còn sót (docs/03 §3)
  var LEFTOVER_BRACKET_RE = /\[(?:Lĩnh vực|Nghệ danh|Anh\/Chị|đệm|Họ và tên)[^\]]*\]/;
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
  };

  function validate(values) {
    var errors = {};
    ['linhVuc', 'ngheDanh', 'hoTen', 'demTen', 'ngay'].forEach(function (k) {
      if (!normalizeText(values[k])) errors[k] = 'Vui lòng nhập ' + LABELS[k] + '.';
    });
    if (!values.ngay || !formatDate(values.ngay)) errors.ngay = 'Vui lòng chọn ngày hồi âm.';
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

  function fill(templateHtml, values) {
    var v = values || {};
    var xung = v.xungHo === 'chị' ? 'chị' : 'anh';
    var val = {
      linhVuc: escapeHtml(normalizeText(v.linhVuc)),
      ngheDanh: escapeHtml(normalizeText(v.ngheDanh)),
      demTen: escapeHtml(normalizeText(v.demTen)),
      hoTen: escapeHtml(normalizeText(v.hoTen)),
      ngay: formatDate(v.ngay),
    };
    return replaceTokens(templateHtml, function (key, ctx) {
      if (key === 'xungHo') {
        return isSentenceStart(ctx.before) ? capFirst(xung) : xung;
      }
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
    fill: fill,
    findLeftovers: findLeftovers,
  };
});
