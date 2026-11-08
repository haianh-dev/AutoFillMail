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

  // ---- Trạng thái tab Nhắn Zalo / FB (NTT, NNT & Quản lý NS) ----
  var msgNttState = { donVi: '', hoTen: '', ngay: '' };
  var msgNntState = { type: 'kmdh', ngheDanh: '', xungHo: 'anh', tuGoi: 'em', kemLink: true, hoTen: '', ngay: '' };
  var msgQlState = { type: 'kmdh', xungHoQL: 'anh', tenQl: '', ngheDanh: '', xungHoNS: 'anh', tuGoi: 'em', kemLink: true, hoTen: '', ngay: '' };

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
        msgNttState.hoTen = saved.hoTen;
        if (msgNttInputs.hoTen) msgNttInputs.hoTen.value = saved.hoTen;
        msgNntState.hoTen = saved.hoTen;
        if (msgNntInputs.hoTen) msgNntInputs.hoTen.value = saved.hoTen;
        msgQlState.hoTen = saved.hoTen;
        if (msgQlInputs.hoTen) msgQlInputs.hoTen.value = saved.hoTen;
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
        msgNttState.ngay = saved.ngay;
        if (msgNttInputs.ngay) msgNttInputs.ngay.value = saved.ngay;
        msgNntState.ngay = saved.ngay;
        if (msgNntInputs.ngay) msgNntInputs.ngay.value = saved.ngay;
        msgQlState.ngay = saved.ngay;
        if (msgQlInputs.ngay) msgQlInputs.ngay.value = saved.ngay;
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
  var ALL_TABS = ['invite', 'subject', 'httt', 'httt-ns', 'cam-on', 'ntt', 'bttt', 'msg-ntt', 'msg-nnt', 'msg-ql'];
  Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (tab) {
    tab.addEventListener('click', function () {
      Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
        t.setAttribute('aria-selected', String(t === tab));
      });
      var curTab = tab.dataset.tab;
      ALL_TABS.forEach(function (id) {
        var el = document.getElementById('tab-' + id);
        if (el) el.hidden = (id !== curTab);
      });

      // Gợi ý dữ liệu liên tab nếu cần
      if (curTab === 'msg-ntt') {
        if (!msgNttState.donVi && nttState.nhaTaiTro) {
          msgNttState.donVi = nttState.nhaTaiTro;
          msgNttInputs.donVi.value = nttState.nhaTaiTro;
          renderMsgNtt();
        }
      } else if (curTab === 'msg-nnt') {
        if (!msgNntState.ngheDanh && values.ngheDanh) {
          msgNntState.ngheDanh = values.ngheDanh;
          msgNntInputs.ngheDanh.value = values.ngheDanh;
          renderMsgNnt();
        }
      } else if (curTab === 'msg-ql') {
        if (!msgQlState.tenQl && htttState.quanLy) {
          msgQlState.tenQl = htttState.quanLy;
          if (msgQlInputs.tenQl) msgQlInputs.tenQl.value = htttState.quanLy;
        }
        if (!msgQlState.ngheDanh && (values.ngheDanh || htttState.nntTen || msgNntState.ngheDanh)) {
          msgQlState.ngheDanh = values.ngheDanh || htttState.nntTen || msgNntState.ngheDanh;
          if (msgQlInputs.ngheDanh) msgQlInputs.ngheDanh.value = msgQlState.ngheDanh;
        }
        renderMsgQl();
      }
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

  // ==========================================
  // LOGIC TAB NHẮN ZALO / FB (NTT & NNT)
  // ==========================================
  var msgNttInputs = {
    donVi: $('#f-msg-ntt-donVi'),
    hoTen: $('#f-msg-ntt-hoTen'),
    ngay: $('#f-msg-ntt-ngay'),
  };

  var msgNntInputs = {
    ngheDanh: $('#f-msg-nnt-ngheDanh'),
    hoTen: $('#f-msg-nnt-hoTen'),
    ngay: $('#f-msg-nnt-ngay'),
    kemLink: $('#f-msg-nnt-kemLink'),
  };
  var msgNntTypeGroup = $('#msg-nnt-type-group');

  function formatMsgPreviewHtml(rawText) {
    var escaped = F.escapeHtml(rawText);
    escaped = escaped.replace(/(\[[^\]]+\])/g, '<span class="msg-placeholder">$1</span>');
    escaped = escaped.replace(/(https:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    return escaped;
  }

  function copyPlainText(text, label) {
    if (!text) return;
    trackEvent('copy-msg');
    function done(ok) {
      showToast(ok ? ('Đã sao chép ' + (label || 'tin nhắn')) : 'Không sao chép được');
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(copyFallback(text)); });
    } else {
      done(copyFallback(text));
    }
  }

  // ---- XÂY DỰNG TIN NHẮN NTT ----
  function buildMsgNttData() {
    var ten = (msgNttState.hoTen || '').trim();
    var donVi = (msgNttState.donVi || '').trim();
    var ngayFmt = F.formatDate(msgNttState.ngay);

    var msg1 = 'Dạ em chào Quý đơn vị ạ. Em là ' + (ten || '[Tên]') + ', phụ trách Đối ngoại Ngày hội hiến máu Sắc Hồng Hy Vọng lần thứ XXVII của Trường ĐH Công nghệ - ĐHQGHN ạ.';

    var msg2 = 'Sau khi tìm hiểu về ' + (donVi || '[Tên đơn vị]') + ', bên em muốn gửi lời mời hợp tác với vai trò nhà tài trợ cho chương trình ạ. Đây là chương trình hiến máu toàn trường lớn nhất trong các trường thuộc ĐHQGHN, tổ chức cùng Viện Huyết học - Truyền máu TW.\n' +
      '- 7h30 – 16h30, thứ Hai 30/11/2026\n' +
      '- Tầng 2 tòa đa năng, ĐH Công nghệ - ĐHQGHN (Hòa Lạc)\n' +
      'Quý đơn vị xem giúp em hồ sơ tài trợ trong đó có đủ quyền lợi và thông tin chi tiết ạ:\n' +
      '📄 [SHHV XXVII] HỒ SƠ TÀI TRỢ: https://drive.google.com/file/d/1-wSQs0wkFYopBaYUYvPCcIz8c4SpsgSq/view?usp=drive_link';

    var msg3 = 'Bên em rất mong nhận được phản hồi trước ngày ' + (ngayFmt || '[../../2026]') + ' ạ. Cần hỗ trợ gì Quý đơn vị nhắn em nhé. Em cảm ơn Quý đơn vị nhiều ạ!';

    return { msg1: msg1, msg2: msg2, msg3: msg3 };
  }

  function renderMsgNtt() {
    var data = buildMsgNttData();
    var p1 = $('#preview-msg-ntt-1');
    var p2 = $('#preview-msg-ntt-2');
    var p3 = $('#preview-msg-ntt-3');
    if (p1) p1.innerHTML = formatMsgPreviewHtml(data.msg1);
    if (p2) p2.innerHTML = formatMsgPreviewHtml(data.msg2);
    if (p3) p3.innerHTML = formatMsgPreviewHtml(data.msg3);
  }

  if (msgNttInputs.donVi) {
    msgNttInputs.donVi.addEventListener('input', function () {
      msgNttState.donVi = msgNttInputs.donVi.value;
      renderMsgNtt();
    });
  }
  if (msgNttInputs.hoTen) {
    msgNttInputs.hoTen.addEventListener('input', function () {
      msgNttState.hoTen = msgNttInputs.hoTen.value;
      saveSender({ hoTen: msgNttState.hoTen });
      renderMsgNtt();
    });
  }
  if (msgNttInputs.ngay) {
    msgNttInputs.ngay.addEventListener('input', function () {
      msgNttState.ngay = msgNttInputs.ngay.value;
      saveSender({ ngay: msgNttState.ngay });
      renderMsgNtt();
    });
  }

  var btnCopyMsgNtt1 = $('#btn-copy-msg-ntt-1');
  if (btnCopyMsgNtt1) {
    btnCopyMsgNtt1.addEventListener('click', function () {
      copyPlainText(buildMsgNttData().msg1, 'tin nhắn 1');
    });
  }
  var btnCopyMsgNtt2 = $('#btn-copy-msg-ntt-2');
  if (btnCopyMsgNtt2) {
    btnCopyMsgNtt2.addEventListener('click', function () {
      copyPlainText(buildMsgNttData().msg2, 'tin nhắn 2');
    });
  }
  var btnCopyMsgNtt3 = $('#btn-copy-msg-ntt-3');
  if (btnCopyMsgNtt3) {
    btnCopyMsgNtt3.addEventListener('click', function () {
      copyPlainText(buildMsgNttData().msg3, 'tin nhắn 3');
    });
  }
  function copyAllMsgNtt() {
    var d = buildMsgNttData();
    var all = 'tin nhắn 1\n' + d.msg1 + '\n\ntin nhắn 2\n' + d.msg2 + '\n\ntin nhắn 3\n' + d.msg3;
    copyPlainText(all, 'toàn bộ 3 tin nhắn');
  }
  var btnCopyMsgNttAll = $('#btn-copy-msg-ntt-all');
  if (btnCopyMsgNttAll) btnCopyMsgNttAll.addEventListener('click', copyAllMsgNtt);
  var btnCopyMsgNttAllTop = $('#btn-copy-msg-ntt-all-top');
  if (btnCopyMsgNttAllTop) btnCopyMsgNttAllTop.addEventListener('click', copyAllMsgNtt);

  // ---- XÂY DỰNG TIN NHẮN NNT (KOL / NGHỆ SĨ) ----
  var NNT_ROLE_NAMES = {
    kmdh: 'Khách mời đồng hành',
    nvtch: 'Nhân vật truyền cảm hứng',
    dsnh: 'Đại sứ ngày hội',
  };

  var NNT_LINKS = {
    kmdh: {
      thuMoi: 'https://drive.google.com/file/d/1_4uVHJusoJql_udP1bY7ab-nz16W9cQ1/view?usp=sharing',
      quyenLoi: 'https://drive.google.com/file/d/1dep2tzmFN3RhE9uFaTVJs-aZ98ly-kbM/view?usp=sharing',
      timeline: 'https://drive.google.com/file/d/15PlET4zPO7aeFcRZ3C4No14PLPuotsMY/view?usp=sharing',
    },
    nvtch: {
      thuMoi: 'https://drive.google.com/file/d/1J7UleXoM5ztNxuBo9mEzUMVwz7vt0aKt/view?usp=sharing',
      quyenLoi: 'https://drive.google.com/file/d/1dep2tzmFN3RhE9uFaTVJs-aZ98ly-kbM/view?usp=sharing',
      timeline: 'https://drive.google.com/file/d/15PlET4zPO7aeFcRZ3C4No14PLPuotsMY/view?usp=sharing',
    },
    dsnh: {
      thuMoi: 'https://drive.google.com/file/d/1AGF15VX4-Hzf-fP4KdEa3mLUIwE8_51v/view?usp=sharing',
      quyenLoi: 'https://drive.google.com/file/d/1dep2tzmFN3RhE9uFaTVJs-aZ98ly-kbM/view?usp=sharing',
      timeline: 'https://drive.google.com/file/d/15PlET4zPO7aeFcRZ3C4No14PLPuotsMY/view?usp=sharing',
    },
  };

  function getXungHoText(val) {
    if (val === 'anh chị') return { lower: 'anh/chị', cap: 'Anh/Chị' };
    if (val === 'chị') return { lower: 'chị', cap: 'Chị' };
    if (val === 'cô') return { lower: 'cô', cap: 'Cô' };
    if (val === 'chú') return { lower: 'chú', cap: 'Chú' };
    if (val === 'band') return { lower: 'band', cap: 'Band' };
    return { lower: 'anh', cap: 'Anh' };
  }

  function getTuGoiText(val) {
    if (val === 'con') return { lower: 'con', cap: 'Con', chung: 'chúng con' };
    if (val === 'cháu') return { lower: 'cháu', cap: 'Cháu', chung: 'chúng cháu' };
    return { lower: 'em', cap: 'Em', chung: 'chúng em' };
  }

  function buildMsgNntData() {
    var ten = (msgNntState.hoTen || '').trim();
    var ngheDanh = (msgNntState.ngheDanh || '').trim();
    var ngayFmt = F.formatDate(msgNntState.ngay);
    var xh = getXungHoText(msgNntState.xungHo);
    var tg = getTuGoiText(msgNntState.tuGoi);
    var cuongVi = NNT_ROLE_NAMES[msgNntState.type] || 'Khách mời đồng hành';
    var links = NNT_LINKS[msgNntState.type] || NNT_LINKS.kmdh;

    var targetName = ngheDanh ? (xh.lower + ' ' + ngheDanh) : ('[' + xh.lower + '] [Nghệ danh/tên]');

    var msg1 = 'Dạ ' + tg.lower + ' chào ' + targetName + ' ạ. ' + tg.cap + ' là ' + (ten || '[Tên]') + ', phụ trách Đối ngoại Ngày hội hiến máu Sắc Hồng Hy Vọng lần thứ XXVII của Trường ĐH Công nghệ - ĐHQGHN ạ.';

    var msg2 = 'Dạ ' + tg.chung + ' có theo dõi những chia sẻ của ' + xh.lower + ' và nhận thấy ' + xh.lower + ' là người có sức ảnh hưởng, truyền được rất nhiều năng lượng tích cực cho các bạn trẻ ạ. Vì vậy ' + tg.chung + ' xin phép mời ' + xh.lower + ' đồng hành cùng Sắc Hồng Hy Vọng lần này với cương vị ' + cuongVi + ' ạ!\n\n' +
      'Sắc Hồng Hy Vọng là ngày hội hiến máu toàn trường lớn nhất trong các trường thuộc ĐHQGHN, do CLB Sinh viên vận động hiến máu Trường ĐH Công nghệ tổ chức cùng Viện Huyết học - Truyền máu Trung ương. Năm nay là lần thứ XXVII, với thông điệp "Thanh niên Việt Nam - Sẵn sàng hiến máu". Chương trình không chỉ để các bạn sinh viên hiến máu cứu người mà còn là nơi các bạn được rèn luyện, trải nghiệm và trưởng thành qua hoạt động tình nguyện ạ.\n\n' +
      'Ngày hội diễn ra:\n' +
      '- 7h30 – 16h30, thứ Hai 30/11/2026\n' +
      '- Tầng 2 tòa đa năng, ĐH Công nghệ - ĐHQGHN (cơ sở Hòa Lạc)\n\n' +
      'Chúng ' + tg.lower + ' tin rằng có sự đồng hành của ' + xh.lower + ', chương trình sẽ đến gần hơn với nhiều người, nhất là giới trẻ ạ. Nếu tiện, ' + xh.lower + ' có thể tới tham dự hoặc chia sẻ về chương trình trên Fanpage giúp bên ' + tg.lower + ' nhé.';

    if (msgNntState.kemLink) {
      msg2 += '\n\n' + xh.cap + ' xem giúp ' + tg.lower + ' thông tin chi tiết và quyền lợi tại đây ạ:\n' +
        '📄 Thư mời ' + cuongVi + ': ' + links.thuMoi + '\n' +
        '📄 Công việc và Quyền lợi: ' + links.quyenLoi + '\n' +
        '📄 Timeline ngày hội: ' + links.timeline;
    }

    var msg3 = 'Chúng ' + tg.lower + ' mong nhận được phản hồi trước ngày ' + (ngayFmt || '[../../2026]') + ' ạ. Cần thêm thông tin ' + xh.lower + ' nhắn ' + tg.lower + ' nhé. ' + tg.cap + ' cảm ơn ' + xh.lower + ' ạ';

    return { msg1: msg1, msg2: msg2, msg3: msg3 };
  }

  function renderMsgNnt() {
    var data = buildMsgNntData();
    var p1 = $('#preview-msg-nnt-1');
    var p2 = $('#preview-msg-nnt-2');
    var p3 = $('#preview-msg-nnt-3');
    if (p1) p1.innerHTML = formatMsgPreviewHtml(data.msg1);
    if (p2) p2.innerHTML = formatMsgPreviewHtml(data.msg2);
    if (p3) p3.innerHTML = formatMsgPreviewHtml(data.msg3);
  }

  if (msgNntTypeGroup) {
    msgNntTypeGroup.addEventListener('click', function (e) {
      var btn = e.target.closest('.seg');
      if (!btn) return;
      msgNntState.type = btn.dataset.type;
      Array.prototype.forEach.call(msgNntTypeGroup.querySelectorAll('.seg'), function (s) {
        s.setAttribute('aria-pressed', String(s === btn));
      });
      renderMsgNnt();
    });
  }

  if (msgNntInputs.ngheDanh) {
    msgNntInputs.ngheDanh.addEventListener('input', function () {
      msgNntState.ngheDanh = msgNntInputs.ngheDanh.value;
      renderMsgNnt();
    });
  }
  if (msgNntInputs.hoTen) {
    msgNntInputs.hoTen.addEventListener('input', function () {
      msgNntState.hoTen = msgNntInputs.hoTen.value;
      saveSender({ hoTen: msgNntState.hoTen });
      renderMsgNnt();
    });
  }
  if (msgNntInputs.ngay) {
    msgNntInputs.ngay.addEventListener('input', function () {
      msgNntState.ngay = msgNntInputs.ngay.value;
      saveSender({ ngay: msgNntState.ngay });
      renderMsgNnt();
    });
  }
  if (msgNntInputs.kemLink) {
    msgNntInputs.kemLink.addEventListener('change', function () {
      msgNntState.kemLink = msgNntInputs.kemLink.checked;
      renderMsgNnt();
    });
  }

  document.querySelectorAll('input[name="msgNntXungHo"]').forEach(function (radio) {
    radio.addEventListener('change', function () {
      if (radio.checked) { msgNntState.xungHo = radio.value; renderMsgNnt(); }
    });
  });

  document.querySelectorAll('input[name="msgNntTuGoi"]').forEach(function (radio) {
    radio.addEventListener('change', function () {
      if (radio.checked) { msgNntState.tuGoi = radio.value; renderMsgNnt(); }
    });
  });

  var btnCopyMsgNnt1 = $('#btn-copy-msg-nnt-1');
  if (btnCopyMsgNnt1) {
    btnCopyMsgNnt1.addEventListener('click', function () {
      copyPlainText(buildMsgNntData().msg1, 'tin nhắn 1');
    });
  }
  var btnCopyMsgNnt2 = $('#btn-copy-msg-nnt-2');
  if (btnCopyMsgNnt2) {
    btnCopyMsgNnt2.addEventListener('click', function () {
      copyPlainText(buildMsgNntData().msg2, 'tin nhắn 2');
    });
  }
  var btnCopyMsgNnt3 = $('#btn-copy-msg-nnt-3');
  if (btnCopyMsgNnt3) {
    btnCopyMsgNnt3.addEventListener('click', function () {
      copyPlainText(buildMsgNntData().msg3, 'tin nhắn 3');
    });
  }
  function copyAllMsgNnt() {
    var d = buildMsgNntData();
    var all = 'tin nhắn 1\n' + d.msg1 + '\n\ntin nhắn 2\n' + d.msg2 + '\n\ntin nhắn 3\n' + d.msg3;
    copyPlainText(all, 'toàn bộ 3 tin nhắn');
  }
  var btnCopyMsgNntAll = $('#btn-copy-msg-nnt-all');
  if (btnCopyMsgNntAll) btnCopyMsgNntAll.addEventListener('click', copyAllMsgNnt);
  var btnCopyMsgNntAllTop = $('#btn-copy-msg-nnt-all-top');
  if (btnCopyMsgNntAllTop) btnCopyMsgNntAllTop.addEventListener('click', copyAllMsgNnt);

  // ---- XÂY DỰNG TIN NHẮN QUẢN LÝ NGHỆ SĨ ----
  var msgQlInputs = {
    tenQl: $('#f-msg-ql-tenQl'),
    ngheDanh: $('#f-msg-ql-ngheDanh'),
    hoTen: $('#f-msg-ql-hoTen'),
    ngay: $('#f-msg-ql-ngay'),
    kemLink: $('#f-msg-ql-kemLink'),
  };
  var msgQlTypeGroup = $('#msg-ql-type-group');

  function getXungHoNs3rdText(val) {
    if (val === 'chị') return { lower: 'chị', cap: 'Chị' };
    if (val === 'bạn ấy') return { lower: 'bạn ấy', cap: 'Bạn ấy' };
    if (val === 'nghệ sĩ') return { lower: 'nghệ sĩ', cap: 'Nghệ sĩ' };
    return { lower: 'anh', cap: 'Anh' };
  }

  function buildMsgQlData() {
    var tenQl = (msgQlState.tenQl || '').trim();
    var ngheDanh = (msgQlState.ngheDanh || '').trim();
    var hoTen = (msgQlState.hoTen || '').trim();
    var ngayFmt = F.formatDate(msgQlState.ngay);
    var xhQL = getXungHoText(msgQlState.xungHoQL);
    var xhNS3 = getXungHoNs3rdText(msgQlState.xungHoNS);
    var tg = getTuGoiText(msgQlState.tuGoi);
    var cuongVi = NNT_ROLE_NAMES[msgQlState.type] || 'Khách mời đồng hành';
    var links = NNT_LINKS[msgQlState.type] || NNT_LINKS.kmdh;

    var targetQL = tenQl ? (xhQL.lower + ' ' + tenQl) : ('[' + xhQL.lower + '] [Tên quản lý]');
    var targetNS = ngheDanh || '[Nghệ danh/tên nghệ sĩ]';
    var senderName = hoTen || '[Họ và tên của bạn]';

    var msg1 = 'Dạ ' + tg.lower + ' chào ' + targetQL + ' ạ. ' + tg.cap + ' là ' + senderName + ', phụ trách Đối ngoại Ngày hội hiến máu Sắc Hồng Hy Vọng lần thứ XXVII của Trường ĐH Công nghệ - ĐHQGHN ạ. ' + tg.cap + ' xin phép được trao đổi với ' + xhQL.lower + ' về việc mời ' + targetNS + ' đồng hành cùng chương trình ạ.';

    var msg2 = 'Dạ ' + tg.chung + ' có theo dõi những chia sẻ của ' + targetNS + ' và nhận thấy ' + xhNS3.lower + ' là người có sức ảnh hưởng, truyền được rất nhiều năng lượng tích cực đến các bạn trẻ ạ. Vì vậy ' + tg.chung + ' xin phép gửi lời mời ' + targetNS + ' đồng hành cùng Sắc Hồng Hy Vọng lần này với cương vị ' + cuongVi + ', và mong ' + xhQL.lower + ' hỗ trợ chuyển lời mời tới nghệ sĩ giúp ' + tg.chung + ' ạ.\n\n' +
      'Sắc Hồng Hy Vọng là ngày hội hiến máu toàn trường lớn nhất trong các trường thuộc ĐHQGHN, do CLB Sinh viên vận động hiến máu Trường ĐH Công nghệ tổ chức cùng Viện Huyết học - Truyền máu Trung ương. Năm nay là lần thứ XXVII, với thông điệp "Thanh niên Việt Nam - Sẵn sàng hiến máu". Chương trình không chỉ để các bạn sinh viên hiến máu cứu người mà còn là nơi các bạn được rèn luyện, trải nghiệm và trưởng thành qua hoạt động tình nguyện ạ.\n\n' +
      'Ngày hội diễn ra:\n' +
      '- 7h30 – 16h30, thứ Hai 30/11/2026\n' +
      '- Tầng 2 tòa đa năng, ĐH Công nghệ - ĐHQGHN (cơ sở Hòa Lạc)\n\n' +
      'Chúng ' + tg.lower + ' tin rằng có sự đồng hành của nghệ sĩ, chương trình sẽ đến gần hơn với nhiều người, nhất là giới trẻ ạ. Nếu lịch trình phù hợp, nghệ sĩ có thể tới tham dự hoặc chia sẻ về chương trình trên Fanpage giúp bên ' + tg.lower + ' nhé.';

    if (msgQlState.kemLink) {
      msg2 += '\n\n' + xhQL.cap + ' xem giúp ' + tg.lower + ' thông tin chi tiết và quyền lợi tại đây ạ:\n' +
        '📄 Thư mời ' + cuongVi + ': ' + links.thuMoi + '\n' +
        '📄 Công việc và Quyền lợi: ' + links.quyenLoi + '\n' +
        '📄 Timeline ngày hội: ' + links.timeline;
    }

    var msg3 = 'Chúng ' + tg.lower + ' mong nhận được phản hồi từ ' + xhQL.lower + ' trước ngày ' + (ngayFmt || '[../../2026]') + ' ạ. Nếu cần thêm thông tin về lịch trình, hình thức tham gia hay các yêu cầu từ phía nghệ sĩ, ' + xhQL.lower + ' nhắn ' + tg.lower + ' để bên ' + tg.lower + ' phối hợp nhé ạ. ' + tg.cap + ' cảm ơn ' + xhQL.lower + ' nhiều ạ!';

    return { msg1: msg1, msg2: msg2, msg3: msg3 };
  }

  function renderMsgQl() {
    var data = buildMsgQlData();
    var p1 = $('#preview-msg-ql-1');
    var p2 = $('#preview-msg-ql-2');
    var p3 = $('#preview-msg-ql-3');
    if (p1) p1.innerHTML = formatMsgPreviewHtml(data.msg1);
    if (p2) p2.innerHTML = formatMsgPreviewHtml(data.msg2);
    if (p3) p3.innerHTML = formatMsgPreviewHtml(data.msg3);
  }

  if (msgQlTypeGroup) {
    msgQlTypeGroup.addEventListener('click', function (e) {
      var btn = e.target.closest('.seg');
      if (!btn) return;
      msgQlState.type = btn.dataset.type;
      Array.prototype.forEach.call(msgQlTypeGroup.querySelectorAll('.seg'), function (s) {
        s.setAttribute('aria-pressed', String(s === btn));
      });
      renderMsgQl();
    });
  }

  if (msgQlInputs.tenQl) {
    msgQlInputs.tenQl.addEventListener('input', function () {
      msgQlState.tenQl = msgQlInputs.tenQl.value;
      renderMsgQl();
    });
  }
  if (msgQlInputs.ngheDanh) {
    msgQlInputs.ngheDanh.addEventListener('input', function () {
      msgQlState.ngheDanh = msgQlInputs.ngheDanh.value;
      renderMsgQl();
    });
  }
  if (msgQlInputs.hoTen) {
    msgQlInputs.hoTen.addEventListener('input', function () {
      msgQlState.hoTen = msgQlInputs.hoTen.value;
      saveSender({ hoTen: msgQlState.hoTen });
      renderMsgQl();
    });
  }
  if (msgQlInputs.ngay) {
    msgQlInputs.ngay.addEventListener('input', function () {
      msgQlState.ngay = msgQlInputs.ngay.value;
      saveSender({ ngay: msgQlState.ngay });
      renderMsgQl();
    });
  }
  if (msgQlInputs.kemLink) {
    msgQlInputs.kemLink.addEventListener('change', function () {
      msgQlState.kemLink = msgQlInputs.kemLink.checked;
      renderMsgQl();
    });
  }

  document.querySelectorAll('input[name="msgQlXungHo"]').forEach(function (radio) {
    radio.addEventListener('change', function () {
      if (radio.checked) { msgQlState.xungHoQL = radio.value; renderMsgQl(); }
    });
  });

  document.querySelectorAll('input[name="msgQlXungHoNs"]').forEach(function (radio) {
    radio.addEventListener('change', function () {
      if (radio.checked) { msgQlState.xungHoNS = radio.value; renderMsgQl(); }
    });
  });

  document.querySelectorAll('input[name="msgQlTuGoi"]').forEach(function (radio) {
    radio.addEventListener('change', function () {
      if (radio.checked) { msgQlState.tuGoi = radio.value; renderMsgQl(); }
    });
  });

  var btnCopyMsgQl1 = $('#btn-copy-msg-ql-1');
  if (btnCopyMsgQl1) {
    btnCopyMsgQl1.addEventListener('click', function () {
      copyPlainText(buildMsgQlData().msg1, 'tin nhắn 1');
    });
  }
  var btnCopyMsgQl2 = $('#btn-copy-msg-ql-2');
  if (btnCopyMsgQl2) {
    btnCopyMsgQl2.addEventListener('click', function () {
      copyPlainText(buildMsgQlData().msg2, 'tin nhắn 2');
    });
  }
  var btnCopyMsgQl3 = $('#btn-copy-msg-ql-3');
  if (btnCopyMsgQl3) {
    btnCopyMsgQl3.addEventListener('click', function () {
      copyPlainText(buildMsgQlData().msg3, 'tin nhắn 3');
    });
  }
  function copyAllMsgQl() {
    var d = buildMsgQlData();
    var all = 'tin nhắn 1\n' + d.msg1 + '\n\ntin nhắn 2\n' + d.msg2 + '\n\ntin nhắn 3\n' + d.msg3;
    copyPlainText(all, 'toàn bộ 3 tin nhắn');
  }
  var btnCopyMsgQlAll = $('#btn-copy-msg-ql-all');
  if (btnCopyMsgQlAll) btnCopyMsgQlAll.addEventListener('click', copyAllMsgQl);
  var btnCopyMsgQlAllTop = $('#btn-copy-msg-ql-all-top');
  if (btnCopyMsgQlAllTop) btnCopyMsgQlAllTop.addEventListener('click', copyAllMsgQl);

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
  renderMsgNtt();
  renderMsgNnt();
  renderMsgQl();
})();
