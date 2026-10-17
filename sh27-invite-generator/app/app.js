/* SH27 — nối UI ↔ fill.js. Không innerHTML/DOMParser với dữ liệu người dùng. */
(function () {
  'use strict';

  var F = window.SH27Fill;
  var LS_KEY = 'sh27.sender';
  var DEBOUNCE_MS = 150;

  if (!window.SH27_TEMPLATES || !F) {
    var banner = document.getElementById('no-templates');
    if (banner) banner.hidden = false;
    return;
  }

  // ---- Trạng thái ----
  var values = {
    type: 'kmdh',
    linhVuc: '',
    ngheDanh: '',
    xungHo: 'anh',
    tuGoi: 'em',
    hoTen: '',
    demTen: '',
    ngay: '',
  };
  var demTenTouched = false;
  var debounceTimer = null;
  var lastValidHtml = null;
  var blobUrl = null;

  // ---- Trạng thái tab HTTT (mail trả lời khi bị từ chối & ngỏ lời hỗ trợ truyền thông) ----
  var httt = { linhVuc: '', nntTen: '', xungHo: 'anh', tuGoi: 'em', hoTen: '' };
  var inputsHttt = {
    linhVuc: $('#f2-linhVuc'),
    nntTen: $('#f2-nntTen'),
    hoTen: $('#f2-hoTen'),
  };
  var previewHttt = $('#preview-httt');
  var btnDownloadHttt = $('#btn-download-httt');
  var btnCopyHttt = $('#btn-copy-httt');
  var blockReasonHttt = $('#block-reason-httt');
  var lastValidHtmlHttt = null;

  // ---- Phần tử DOM ----
  var $ = function (sel) { return document.querySelector(sel); };
  var inputs = {
    linhVuc: $('#f-linhVuc'),
    ngheDanh: $('#f-ngheDanh'),
    hoTen: $('#f-hoTen'),
    demTen: $('#f-demTen'),
    ngay: $('#f-ngay'),
  };
  var typeGroup = $('#type-group');
  var preview = $('#preview');
  var btnDownload = $('#btn-download');
  var btnCopy = $('#btn-copy');
  var btnOpenTab = $('#btn-open-tab');
  var toast = $('#toast');
  var blockReason = $('#block-reason');

  // ---- localStorage (FR-6) — gộp để 2 tab cùng dùng, không ghi đè nhau ----
  function saveSender(patch) {
    try {
      var saved = {};
      try { saved = JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch (e2) { saved = {}; }
      if (patch) {
        for (var k in patch) saved[k] = patch[k];
      } else {
        saved.hoTen = values.hoTen;
        saved.demTen = values.demTen;
        saved.ngay = values.ngay;
      }
      localStorage.setItem(LS_KEY, JSON.stringify(saved));
    } catch (e) { /* bỏ qua */ }
  }

  function loadSender() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      var saved = JSON.parse(raw);
      if (saved.hoTen) {
        values.hoTen = saved.hoTen; inputs.hoTen.value = saved.hoTen;
        httt.hoTen = saved.hoTen; inputsHttt.hoTen.value = saved.hoTen;
      }
      if (saved.demTen) { values.demTen = saved.demTen; inputs.demTen.value = saved.demTen; demTenTouched = true; }
      if (saved.ngay) { values.ngay = saved.ngay; inputs.ngay.value = saved.ngay; }
    } catch (e) { /* localStorage có thể bị chặn — bỏ qua */ }
  }

  // ---- Render ----
  function render() {
    var tpl = window.SH27_TEMPLATES[values.type];
    var html = F.fill(tpl, values);
    preview.srcdoc = html;
    renderSubjects();

    var v = F.validate(values);
    var leftovers = F.findLeftovers(html);
    var canExport = v.ok && leftovers.length === 0;

    btnDownload.disabled = !canExport;
    btnCopy.disabled = !canExport;

    if (canExport) {
      lastValidHtml = html;
      blockReason.textContent = '';
    } else {
      lastValidHtml = null;
      var missing = Object.keys(v.errors).length > 0;
      blockReason.textContent = leftovers.length > 0
        ? 'Còn sót placeholder (dữ liệu nhập chứa ký tự giống placeholder) — không thể tải.'
        : (missing ? 'Vui lòng điền đủ các ô bắt buộc để tải hoặc sao chép.' : '');
    }

    // Lỗi từng ô
    ['linhVuc', 'ngheDanh', 'hoTen', 'demTen', 'ngay'].forEach(function (key) {
      var errEl = document.querySelector('[data-err="' + key + '"]');
      var msg = v.errors[key] || '';
      if (errEl) errEl.textContent = msg;
      if (inputs[key]) inputs[key].classList.toggle('invalid', !!msg);
    });
  }

  function scheduleRender() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(render, DEBOUNCE_MS);
  }

  // ---- Sự kiện form ----
  typeGroup.addEventListener('click', function (e) {
    var btn = e.target.closest('.seg');
    if (!btn) return;
    values.type = btn.dataset.type;
    Array.prototype.forEach.call(typeGroup.querySelectorAll('.seg'), function (s) {
      s.setAttribute('aria-pressed', String(s === btn));
    });
    render();
  });

  inputs.linhVuc.addEventListener('input', function () { values.linhVuc = inputs.linhVuc.value; scheduleRender(); });
  inputs.ngheDanh.addEventListener('input', function () { values.ngheDanh = inputs.ngheDanh.value; scheduleRender(); });

  inputs.hoTen.addEventListener('input', function () {
    values.hoTen = inputs.hoTen.value;
    if (!demTenTouched) {
      values.demTen = F.deriveDemTen(values.hoTen);
      inputs.demTen.value = values.demTen;
    }
    scheduleRender();
  });

  inputs.demTen.addEventListener('input', function () {
    values.demTen = inputs.demTen.value;
    // nếu người dùng xoá trống → resume tự gợi ý
    demTenTouched = values.demTen.trim() !== '';
    scheduleRender();
  });

  inputs.ngay.addEventListener('input', function () { values.ngay = inputs.ngay.value; scheduleRender(); });

  document.querySelectorAll('input[name="xungHo"]').forEach(function (radio) {
    radio.addEventListener('change', function () {
      if (radio.checked) { values.xungHo = radio.value; render(); }
    });
  });

  document.querySelectorAll('input[name="tuGoi"]').forEach(function (radio) {
    radio.addEventListener('change', function () {
      if (radio.checked) { values.tuGoi = radio.value; render(); }
    });
  });

  // ---- Chuyển tab ----
  Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (tab) {
    tab.addEventListener('click', function () {
      Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
        t.setAttribute('aria-selected', String(t === tab));
      });
      document.getElementById('tab-invite').hidden = tab.dataset.tab !== 'invite';
      document.getElementById('tab-subject').hidden = tab.dataset.tab !== 'subject';
      document.getElementById('tab-httt').hidden = tab.dataset.tab !== 'httt';
    });
  });

  // ---- Tab Mail HTTT: mẫu thư trả lời khi bị từ chối & ngỏ lời hỗ trợ truyền thông ----
  function renderHttt() {
    var html = F.fill(window.SH27_TEMPLATES.httt, httt);
    previewHttt.srcdoc = html;

    var v = F.validate(Object.assign({ type: 'httt' }, httt));
    var leftovers = F.findLeftovers(html);
    var canExport = v.ok && leftovers.length === 0;

    btnDownloadHttt.disabled = !canExport;
    btnCopyHttt.disabled = !canExport;
    lastValidHtmlHttt = canExport ? html : null;

    if (canExport) {
      blockReasonHttt.textContent = '';
    } else {
      var missing = Object.keys(v.errors).length > 0;
      blockReasonHttt.textContent = leftovers.length > 0
        ? 'Còn sót placeholder (dữ liệu nhập chứa ký tự giống placeholder) — không thể tải.'
        : (missing ? 'Vui lòng điền đủ các ô bắt buộc để tải hoặc sao chép.' : '');
    }

    ['linhVuc', 'nntTen', 'hoTen'].forEach(function (key) {
      var errEl = document.querySelector('[data-err2="' + key + '"]');
      var msg = v.errors[key] || '';
      if (errEl) errEl.textContent = msg;
      if (inputsHttt[key]) inputsHttt[key].classList.toggle('invalid', !!msg);
    });
  }

  function scheduleRenderHttt() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(renderHttt, DEBOUNCE_MS);
  }

  inputsHttt.linhVuc.addEventListener('input', function () { httt.linhVuc = inputsHttt.linhVuc.value; scheduleRenderHttt(); });
  inputsHttt.nntTen.addEventListener('input', function () { httt.nntTen = inputsHttt.nntTen.value; scheduleRenderHttt(); });
  inputsHttt.hoTen.addEventListener('input', function () { httt.hoTen = inputsHttt.hoTen.value; scheduleRenderHttt(); });

  document.querySelectorAll('input[name="xungHo2"]').forEach(function (radio) {
    radio.addEventListener('change', function () {
      if (radio.checked) { httt.xungHo = radio.value; renderHttt(); }
    });
  });

  document.querySelectorAll('input[name="tuGoi2"]').forEach(function (radio) {
    radio.addEventListener('change', function () {
      if (radio.checked) { httt.tuGoi = radio.value; renderHttt(); }
    });
  });

  // ---- Tab chủ đề email (FR-7): dùng chung Lĩnh vực + Nghệ danh của form Thư mời ----
  var SUBJECT_PREFIX = 'Sắc Hồng Hy Vọng XXVII | Thư mời ';
  var SUBJECT_ROLES = {
    kmdh: 'Khách mời đồng hành',
    nvtch: 'Nhân vật truyền cảm hứng',
    dsnh: 'Đại sứ ngày hội',
  };
  var subjectButtons = {
    kmdh: $('#btn-copy-subject-kmdh'),
    nvtch: $('#btn-copy-subject-nvtch'),
    dsnh: $('#btn-copy-subject-dsnh'),
  };
  var subjectOutputs = {
    kmdh: $('#subject-kmdh'),
    nvtch: $('#subject-nvtch'),
    dsnh: $('#subject-dsnh'),
  };

  function buildSubject(type) {
    var lv = F.normalizeText(values.linhVuc);
    var nd = F.normalizeText(values.ngheDanh);
    if (!lv || !nd) return '';
    return SUBJECT_PREFIX + SUBJECT_ROLES[type] + ' | ' + lv + ' ' + nd;
  }

  function renderSubjects() {
    ['kmdh', 'nvtch', 'dsnh'].forEach(function (type) {
      var s = buildSubject(type);
      subjectOutputs[type].textContent = s;
      subjectButtons[type].disabled = !s;
    });
  }

  ['kmdh', 'nvtch', 'dsnh'].forEach(function (type) {
    subjectButtons[type].addEventListener('click', function () {
      var s = buildSubject(type);
      if (!s) return;
      trackEvent('copy-subject-' + type);
      function done(ok) {
        showToast(ok ? 'Đã sao chép chủ đề' : 'Không sao chép được — hãy bôi đen và copy thủ công');
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(s).then(function () { done(true); }, function () { done(copyFallback(s)); });
      } else {
        done(copyFallback(s));
      }
    });
  });

  // ---- Thống kê ẩn danh (GoatCounter) — chỉ tên sự kiện, KHÔNG gửi dữ liệu người dùng nhập ----
  function trackEvent(name) {
    try {
      if (window.goatcounter && typeof window.goatcounter.count === 'function') {
        window.goatcounter.count({ path: name, title: name, event: true });
      }
    } catch (e) { /* offline / chặn mạng — bỏ qua, không ảnh hưởng app */ }
  }

  // ---- Tải về (FR-3) ----
  function currentFilename() {
    return 'SH27-' + values.type + '-' + (F.slugify(values.ngheDanh) || 'kol') + '.html';
  }

  function currentHtml() {
    if (lastValidHtml !== null) return lastValidHtml;
    return F.fill(window.SH27_TEMPLATES[values.type], values);
  }

  btnDownload.addEventListener('click', function () {
    if (!lastValidHtml) return;
    trackEvent('tai-' + values.type);
    var blob = new Blob([lastValidHtml], { type: 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = currentFilename();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    saveSender();
  });

  // ---- Sao chép (FR-4) ----
  function showToast(msg) {
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () { toast.hidden = true; }, 1800);
  }

  function copyFallback(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  // ---- Sao chép HTML giàu định dạng (FR-4): dán vào Gmail là nội dung hiển thị, căn trái ----
  // Chỉ áp dụng cho clipboard; file tải về vẫn giữ nguyên từng byte như template.
  function toPasteHtml(html) {
    return String(html)
      .replace(/<body([^>]*)>/i, '<body$1><div style="text-align:left;" align="left">')
      .replace(/<\/body\s*>/i, '</div></body>');
  }

  // Firefox/clipboard API không khả dụng → render tạm ngoài màn hình rồi copy vùng chọn
  function copyHtmlFallback(html) {
    var div = document.createElement('div');
    div.contentEditable = 'true';
    div.style.position = 'fixed';
    div.style.left = '-9999px';
    div.innerHTML = toPasteHtml(html); // dữ liệu đã được escapeHtml trong fill.js, chỉ dùng cho clipboard tạm
    document.body.appendChild(div);
    var range = document.createRange();
    range.selectNodeContents(div);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    sel.removeAllRanges();
    document.body.removeChild(div);
    return ok;
  }

  btnCopy.addEventListener('click', function () {
    if (!lastValidHtml) return;
    trackEvent('copy-' + values.type);
    var html = lastValidHtml;
    function done(ok) {
      showToast(ok ? 'Đã sao chép — dán trực tiếp vào Gmail' : 'Không sao chép được — hãy dùng nút Tải file HTML');
      if (ok) saveSender();
    }
    if (navigator.clipboard && window.ClipboardItem && typeof navigator.clipboard.write === 'function') {
      var item = null;
      try {
        item = new ClipboardItem({
          'text/html': new Blob([toPasteHtml(html)], { type: 'text/html' }),
          'text/plain': new Blob([html], { type: 'text/plain' }),
        });
      } catch (e) { item = null; }
      if (item) {
        navigator.clipboard.write([item]).then(function () { done(true); }, function () { done(copyHtmlFallback(html)); });
        return;
      }
    }
    done(copyHtmlFallback(html));
  });

  // ---- Mở tab mới (FR-5) ----
  btnOpenTab.addEventListener('click', function () {
    var blob = new Blob([currentHtml()], { type: 'text/html;charset=utf-8' });
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, '_blank');
  });

  // ---- Tải về / Sao chép cho tab HTTT ----
  btnDownloadHttt.addEventListener('click', function () {
    if (!lastValidHtmlHttt) return;
    trackEvent('tai-httt');
    var blob = new Blob([lastValidHtmlHttt], { type: 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'SH27-httt-' + (F.slugify(httt.nntTen) || 'nnt') + '.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    saveSender({ hoTen: httt.hoTen });
  });

  btnCopyHttt.addEventListener('click', function () {
    if (!lastValidHtmlHttt) return;
    trackEvent('copy-httt');
    var html = lastValidHtmlHttt;
    function done(ok) {
      showToast(ok ? 'Đã sao chép — dán trực tiếp vào Gmail' : 'Không sao chép được — hãy dùng nút Tải file HTML');
      if (ok) saveSender({ hoTen: httt.hoTen });
    }
    if (navigator.clipboard && window.ClipboardItem && typeof navigator.clipboard.write === 'function') {
      var item = null;
      try {
        item = new ClipboardItem({
          'text/html': new Blob([toPasteHtml(html)], { type: 'text/html' }),
          'text/plain': new Blob([html], { type: 'text/plain' }),
        });
      } catch (e) { item = null; }
      if (item) {
        navigator.clipboard.write([item]).then(function () { done(true); }, function () { done(copyHtmlFallback(html)); });
        return;
      }
    }
    done(copyHtmlFallback(html));
  });

  // ---- Khởi động ----
  loadSender();
  renderSubjects();
  var firstSeg = typeGroup.querySelector('.seg[data-type="kmdh"]');
  if (firstSeg) firstSeg.setAttribute('aria-pressed', 'true');
  render();
  renderHttt();
})();
