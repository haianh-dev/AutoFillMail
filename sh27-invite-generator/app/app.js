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

  // ---- Trạng thái tab HTTT (qua quản lý), HTTT-NS (gửi thẳng nghệ sĩ) & Cảm ơn ----
  var htttState = { quanLy: '', nntTen: '', xungHoQL: 'anh', xungHoNS: 'anh', tuGoi: 'em', hoTen: '' };
  var htttNsState = { nntTen: '', xungHoNS: 'anh', tuGoi: 'em', hoTen: '' };
  var camonState = { linhVuc: '', nntTen: '', xungHoNS: 'anh', tuGoi: 'em', hoTen: '' };
  var nttState = { nhaTaiTro: '', demTen: '', ngay: '', hoTen: '' };
  var btttState = { donViBttt: '', demTen: '', ngay: '', hoTen: '' };

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
        // seed cả 5 flow HTTT, HTTT-NS, Cảm ơn, NTT, BTTT (được tạo sau nhưng loadSender luôn chạy sau cùng)
        [htttFlow, htttNsFlow, camonFlow, nttFlow, btttFlow].forEach(function (flow) {
          flow.state.hoTen = saved.hoTen;
          flow.inputs.hoTen.value = saved.hoTen;
        });
      }
      if (saved.demTen) {
        values.demTen = saved.demTen; inputs.demTen.value = saved.demTen; demTenTouched = true;
        // seed demTen cho NTT và BTTT
        [nttFlow, btttFlow].forEach(function (flow) {
          if (flow.inputs.demTen) { flow.state.demTen = saved.demTen; flow.inputs.demTen.value = saved.demTen; }
        });
      }
      if (saved.ngay) {
        values.ngay = saved.ngay; inputs.ngay.value = saved.ngay;
        // seed ngay cho NTT và BTTT
        [nttFlow, btttFlow].forEach(function (flow) {
          if (flow.inputs.ngay) { flow.state.ngay = saved.ngay; flow.inputs.ngay.value = saved.ngay; }
        });
      }
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

  var linhVucChips = $('#linhVuc-chips');
  function updateChipsState() {
    if (!linhVucChips) return;
    var current = (values.linhVuc || '').trim().toLowerCase();
    Array.prototype.forEach.call(linhVucChips.querySelectorAll('.chip'), function (chip) {
      chip.classList.toggle('active', chip.dataset.val.toLowerCase() === current);
    });
  }

  if (linhVucChips) {
    linhVucChips.addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (!chip) return;
      var val = chip.dataset.val;
      if (values.linhVuc === val) {
        values.linhVuc = '';
        inputs.linhVuc.value = '';
      } else {
        values.linhVuc = val;
        inputs.linhVuc.value = val;
      }
      updateChipsState();
      scheduleRender();
    });
  }

  inputs.linhVuc.addEventListener('input', function () {
    values.linhVuc = inputs.linhVuc.value;
    updateChipsState();
    scheduleRender();
  });
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
      document.getElementById('tab-httt-ns').hidden = tab.dataset.tab !== 'httt-ns';
      document.getElementById('tab-cam-on').hidden = tab.dataset.tab !== 'cam-on';
      document.getElementById('tab-ntt').hidden = tab.dataset.tab !== 'ntt';
      document.getElementById('tab-bttt').hidden = tab.dataset.tab !== 'bttt';
    });
  });

  // ---- Tab Mail HTTT & HTTT-NS: cùng một mẫu logic, khác form/template ----
  // cfg: type, state, inputs {key: selector}, radios [{name, key}], preview/btnDownload/btnCopy/blockReason selectors, errAttr
  function makeHtttFlow(cfg) {
    var state = cfg.state;
    var inputs = {};
    Object.keys(cfg.inputs).forEach(function (k) { inputs[k] = $(cfg.inputs[k]); });
    var preview = $(cfg.preview);
    var btnDownload = $(cfg.btnDownload);
    var btnCopy = $(cfg.btnCopy);
    var blockReason = $(cfg.blockReason);
    var lastValid = null;

    function render() {
      var html = F.fill(window.SH27_TEMPLATES[cfg.type], state);
      preview.srcdoc = html;

      var v = F.validate(Object.assign({ type: cfg.type }, state));
      var leftovers = F.findLeftovers(html);
      var canExport = v.ok && leftovers.length === 0;

      btnDownload.disabled = !canExport;
      btnCopy.disabled = !canExport;
      lastValid = canExport ? html : null;

      if (canExport) {
        blockReason.textContent = '';
      } else {
        var missing = Object.keys(v.errors).length > 0;
        blockReason.textContent = leftovers.length > 0
          ? 'Còn sót placeholder (dữ liệu nhập chứa ký tự giống placeholder) — không thể tải.'
          : (missing ? 'Vui lòng điền đủ các ô bắt buộc để tải hoặc sao chép.' : '');
      }

      Object.keys(inputs).forEach(function (key) {
        var errEl = document.querySelector('[' + cfg.errAttr + '="' + key + '"]');
        var msg = v.errors[key] || '';
        if (errEl) errEl.textContent = msg;
        if (inputs[key]) inputs[key].classList.toggle('invalid', !!msg);
      });

      if (typeof cfg.onRender === 'function') cfg.onRender(state);
    }

    function scheduleRender() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(render, DEBOUNCE_MS);
    }

    Object.keys(inputs).forEach(function (key) {
      inputs[key].addEventListener('input', function () { state[key] = inputs[key].value; scheduleRender(); });
    });

    cfg.radios.forEach(function (r) {
      document.querySelectorAll('input[name="' + r.name + '"]').forEach(function (radio) {
        radio.addEventListener('change', function () {
          if (radio.checked) { state[r.key] = radio.value; render(); }
        });
      });
    });

    btnDownload.addEventListener('click', function () {
      if (!lastValid) return;
      trackEvent('tai-' + cfg.type);
      var blob = new Blob([lastValid], { type: 'text/html;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'SH27-' + cfg.type + '-' + (F.slugify(state.nntTen || state.nhaTaiTro || state.donViBttt || state.quanLy) || 'mail') + '.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      var patch = { hoTen: state.hoTen };
      if (state.demTen) patch.demTen = state.demTen;
      if (state.ngay) patch.ngay = state.ngay;
      saveSender(patch);
    });

    btnCopy.addEventListener('click', function () {
      if (!lastValid) return;
      trackEvent('copy-' + cfg.type);
      var html = lastValid;
      function done(ok) {
        showToast(ok ? 'Đã sao chép — dán trực tiếp vào Gmail' : 'Không sao chép được — hãy dùng nút Tải file HTML');
        if (ok) {
          var p = { hoTen: state.hoTen };
          if (state.demTen) p.demTen = state.demTen;
          if (state.ngay) p.ngay = state.ngay;
          saveSender(p);
        }
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

    return { state: state, inputs: inputs, render: render };
  }

  var htttFlow = makeHtttFlow({
    type: 'httt',
    state: htttState,
    inputs: { quanLy: '#f2-quanLy', nntTen: '#f2-nntTen', hoTen: '#f2-hoTen' },
    radios: [
      { name: 'xungHo2', key: 'xungHoQL' },
      { name: 'xungHo2NS', key: 'xungHoNS' },
      { name: 'tuGoi2', key: 'tuGoi' },
    ],
    preview: '#preview-httt',
    btnDownload: '#btn-download-httt',
    btnCopy: '#btn-copy-httt',
    blockReason: '#block-reason-httt',
    errAttr: 'data-err2',
  });

  var htttNsFlow = makeHtttFlow({
    type: 'httt-ns',
    state: htttNsState,
    inputs: { nntTen: '#f3-nntTen', hoTen: '#f3-hoTen' },
    radios: [
      { name: 'xungHo3', key: 'xungHoNS' },
      { name: 'tuGoi3', key: 'tuGoi' },
    ],
    preview: '#preview-httt-ns',
    btnDownload: '#btn-download-httt-ns',
    btnCopy: '#btn-copy-httt-ns',
    blockReason: '#block-reason-httt-ns',
    errAttr: 'data-err3',
  });

  var camonFlow = makeHtttFlow({
    type: 'cam-on',
    state: camonState,
    inputs: { linhVuc: '#f4-linhVuc', nntTen: '#f4-nntTen', hoTen: '#f4-hoTen' },
    radios: [
      { name: 'xungHo4', key: 'xungHoNS' },
      { name: 'tuGoi4', key: 'tuGoi' },
    ],
    preview: '#preview-camon',
    btnDownload: '#btn-download-camon',
    btnCopy: '#btn-copy-camon',
    blockReason: '#block-reason-camon',
    errAttr: 'data-err4',
  });

  // Chips cho tab cảm ơn
  var camonChips = $('#linhVuc-chips-camon');
  function updateCamonChipsState() {
    if (!camonChips) return;
    var current = (camonState.linhVuc || '').trim().toLowerCase();
    Array.prototype.forEach.call(camonChips.querySelectorAll('.chip'), function (chip) {
      chip.classList.toggle('active', chip.dataset.val.toLowerCase() === current);
    });
  }
  if (camonChips) {
    camonChips.addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (!chip) return;
      var val = chip.dataset.val;
      if (camonState.linhVuc === val) {
        camonState.linhVuc = '';
        camonFlow.inputs.linhVuc.value = '';
      } else {
        camonState.linhVuc = val;
        camonFlow.inputs.linhVuc.value = val;
      }
      updateCamonChipsState();
      camonFlow.render();
    });
  }
  if (camonFlow.inputs.linhVuc) {
    camonFlow.inputs.linhVuc.addEventListener('input', updateCamonChipsState);
  }

  // ---- Tab NTT (Nhà tài trợ) ----
  var nttFlow = makeHtttFlow({
    type: 'ntt',
    state: nttState,
    inputs: { nhaTaiTro: '#f5-nhaTaiTro', demTen: '#f5-demTen', ngay: '#f5-ngay', hoTen: '#f5-hoTen' },
    radios: [],
    preview: '#preview-ntt',
    btnDownload: '#btn-download-ntt',
    btnCopy: '#btn-copy-ntt',
    blockReason: '#block-reason-ntt',
    errAttr: 'data-err5',
    onRender: function () { renderSubjects(); },
  });

  // ---- Tab BTTT (Bảo trợ truyền thông) ----
  var btttFlow = makeHtttFlow({
    type: 'bttt',
    state: btttState,
    inputs: { donViBttt: '#f6-donViBttt', demTen: '#f6-demTen', ngay: '#f6-ngay', hoTen: '#f6-hoTen' },
    radios: [],
    preview: '#preview-bttt',
    btnDownload: '#btn-download-bttt',
    btnCopy: '#btn-copy-bttt',
    blockReason: '#block-reason-bttt',
    errAttr: 'data-err6',
    onRender: function () { renderSubjects(); },
  });

  // ---- Tab chủ đề email (FR-7): tự động điền từ các tab tương ứng ----
  var ALL_SUBJECT_TYPES = ['kmdh', 'nvtch', 'dsnh', 'bttt', 'ntt'];
  var subjectButtons = {
    kmdh: $('#btn-copy-subject-kmdh'),
    nvtch: $('#btn-copy-subject-nvtch'),
    dsnh: $('#btn-copy-subject-dsnh'),
    bttt: $('#btn-copy-subject-bttt'),
    ntt: $('#btn-copy-subject-ntt'),
  };
  var subjectOutputs = {
    kmdh: $('#subject-kmdh'),
    nvtch: $('#subject-nvtch'),
    dsnh: $('#subject-dsnh'),
    bttt: $('#subject-bttt'),
    ntt: $('#subject-ntt'),
  };

  function getSubject(type) {
    if (type === 'bttt') return F.buildSubject('bttt', btttState);
    if (type === 'ntt') return F.buildSubject('ntt', nttState);
    return F.buildSubject(type, values);
  }

  function renderSubjects() {
    ALL_SUBJECT_TYPES.forEach(function (type) {
      var s = getSubject(type);
      if (subjectOutputs[type]) {
        subjectOutputs[type].textContent = s;
      }
      if (subjectButtons[type]) {
        subjectButtons[type].disabled = !s;
      }
    });
  }

  ALL_SUBJECT_TYPES.forEach(function (type) {
    if (!subjectButtons[type]) return;
    subjectButtons[type].addEventListener('click', function () {
      var s = getSubject(type);
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

  // ---- Khởi động ----
  loadSender();
  renderSubjects();
  var firstSeg = typeGroup.querySelector('.seg[data-type="kmdh"]');
  if (firstSeg) firstSeg.setAttribute('aria-pressed', 'true');
  render();
  htttFlow.render();
  htttNsFlow.render();
  camonFlow.render();
  nttFlow.render();
  btttFlow.render();
})();
