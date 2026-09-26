/* Pesticide Logger — Photos, barcode and label scanning. */
'use strict';

// -------------------------------------------------------------- photos & barcode

// Photos live in IndexedDB. Full backups pack JPEG payloads next to the
// farm JSON so a phone→PC move keeps label/lot photos.

function idbPhotosGetAll() {
  return new Promise((res) => {
    if (!idbDb || !idbDb.objectStoreNames.contains('photos')) return res([]);
    try {
      const req = idbDb.transaction('photos', 'readonly').objectStore('photos').getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => res([]);
    } catch (e) { res([]); }
  });
}

function idbPhotosClear() {
  return new Promise((res) => {
    if (!idbDb || !idbDb.objectStoreNames.contains('photos')) return res();
    try {
      const tx = idbDb.transaction('photos', 'readwrite');
      tx.objectStore('photos').clear();
      tx.oncomplete = () => res();
      tx.onerror = () => res();
    } catch (e) { res(); }
  });
}

async function idbPhotosPutAll(photos) {
  let n = 0;
  for (const p of photos || []) {
    const clean = (typeof BackupPack !== 'undefined' && BackupPack.sanitizePhoto)
      ? BackupPack.sanitizePhoto(p)
      : p;
    if (!clean) continue;
    try {
      await idbPhotoPut(clean);
      n++;
    } catch (e) { /* skip one bad photo */ }
  }
  return n;
}

function idbPhotoPut(photo) {
  return new Promise((res, rej) => {
    if (!idbDb) return rej(new Error('no idb'));
    const tx = idbDb.transaction('photos', 'readwrite');
    tx.objectStore('photos').put(photo);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

function idbPhotoGet(id) {
  return new Promise((res) => {
    if (!idbDb) return res(null);
    try {
      const get = idbDb.transaction('photos', 'readonly').objectStore('photos').get(id);
      get.onsuccess = () => res(get.result || null);
      get.onerror = () => res(null);
    } catch (e) { res(null); }
  });
}

function idbPhotoDelete(id) {
  return new Promise((res) => {
    if (!idbDb) return res();
    try {
      const tx = idbDb.transaction('photos', 'readwrite');
      tx.objectStore('photos').delete(id);
      tx.oncomplete = () => res();
      tx.onerror = () => res();
    } catch (e) { res(); }
  });
}

function referencedPhotoIds() {
  const ids = new Set();
  const collect = (arr) => (arr || []).forEach(pid => ids.add(pid));
  data.applications.forEach(a => {
    collect(a.photoIds);
    (a.history || []).forEach(h => collect(h.snapshot && h.snapshot.photoIds));
  });
  data.products.forEach(p => collect(p.photoIds));
  return ids;
}

function sweepOrphanPhotos() {
  if (!idbDb || !idbDb.objectStoreNames.contains('photos')) return;
  const keep = referencedPhotoIds();
  try {
    const store = idbDb.transaction('photos', 'readwrite').objectStore('photos');
    const cursorReq = store.openCursor();
    cursorReq.onsuccess = () => {
      const cur = cursorReq.result;
      if (!cur) return;
      // Grace period: never sweep photos under 24h old (may be mid-form).
      const fresh = cur.value.createdAt && Date.now() - new Date(cur.value.createdAt).getTime() < 86400000;
      if (!keep.has(cur.value.id) && !fresh) cur.delete();
      cur.continue();
    };
  } catch (e) { /* sweep is best-effort */ }
}

function compressImage(file, maxDim, quality) {
  return new Promise((res, rej) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, (maxDim || 1280) / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      res(canvas.toDataURL('image/jpeg', quality || 0.8));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('bad image')); };
    img.src = url;
  });
}

// Scale a label photo into the OCR sweet spot and boost contrast. Never
// invents REI / PHI / rates — this is only so Tesseract can read the
// EPA Reg. No. line.
function enhanceLabelImage(file) {
  return new Promise((res, rej) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const longest = Math.max(img.width, img.height) || 1;
      const minDim = 1400;
      const maxDim = 2200;
      let scale = 1;
      if (longest < minDim) scale = minDim / longest;
      else if (longest > maxDim) scale = maxDim / longest;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      try { ctx.filter = 'grayscale(1) contrast(1.35)'; } catch (e) { /* older canvas */ }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      res(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('bad image')); };
    img.src = url;
  });
}

let photoAttachHandler = null;

async function capturePhotoInto(idList, thumbsHost, label) {
  const input = $('#photo-attach-input');
  const saveFile = async (file) => {
    try {
      const dataUrl = await compressImage(file, 1280);
      const photo = { id: uid(), dataUrl, label: label || '', createdAt: new Date().toISOString() };
      await idbPhotoPut(photo);
      idList.push(photo.id);
      renderPhotoThumbs(idList, thumbsHost);
      toast('Photo attached');
    } catch (e) {
      toast('Could not read that image');
    }
  };
  if (input && CameraScan.inPageFileInputReady(input)) {
    photoAttachHandler = saveFile;
    input.click();
    return;
  }
  toast('Photo capture is not available in this view');
}

// Photos are only ever created via canvas.toDataURL('image/jpeg'); anything
// else in the store (tampered IDB) must not reach an img src.
function photoDataSrc(p) {
  return CameraScan.photoDataSrc(p);
}

async function renderPhotoThumbs(idList, host) {
  if (!host) return;
  if (!idList.length) { host.innerHTML = ''; return; }
  const photos = (await Promise.all(idList.map(idbPhotoGet))).filter(Boolean);
  host.innerHTML = photos.map(p =>
    `<button type="button" class="photo-thumb" data-photo-id="${esc(p.id)}" aria-label="View photo">
        <img src="${photoDataSrc(p)}" alt="">
      </button>`).join('');
  host.querySelectorAll('[data-photo-id]').forEach(b =>
    b.addEventListener('click', () => openPhotoViewer(b.dataset.photoId, idList, host)));
}

async function openPhotoViewer(photoId, idList, thumbsHost) {
  const p = await idbPhotoGet(photoId);
  if (!p) { toast('Photo not found on this device'); return; }
  const dlg = $('#photo-dialog');
  $('#photo-dialog-img').src = photoDataSrc(p);
  $('#photo-dialog-meta').textContent =
    `Taken ${new Date(p.createdAt).toLocaleString()} — included in Download backup.`;
  $('#photo-dialog-delete').onclick = async () => {
    const idx = idList.indexOf(photoId);
    if (idx >= 0) idList.splice(idx, 1);
    await idbPhotoDelete(photoId);
    renderPhotoThumbs(idList, thumbsHost);
    dlg.close();
    toast('Photo removed');
  };
  dlg.showModal();
}

// ---- barcode scanning ----
// Chromium/Android: live BarcodeDetector + getUserMedia preview.
// iPhone / Firefox: native camera still photo + vendored ZXing decoder.
// Scan barcode is always offered; only the capture method changes.
// Mix identity is Scan label (still photo + OCR). Barcode is secondary.

let scanStream = null;
const BARCODE_FORMATS = CameraScan.BARCODE_FORMATS;

function liveBarcodeSupported() {
  return CameraScan.liveBarcodeSupported(window);
}

function stopScanStream() {
  CameraScan.stopMediaStream(scanStream);
  scanStream = null;
  const video = $('#scan-video');
  if (video) video.srcObject = null;
}

function closeScanner() {
  stopScanStream();
  const dlg = $('#scan-dialog');
  if (dlg && dlg.open) dlg.close();
}

async function openScanner(onCode, options) {
  if (!liveBarcodeSupported()) {
    toast('Use Scan barcode to photograph the UPC, or Scan label for the EPA Reg. No. line');
    return;
  }
  const dlg = $('#scan-dialog');
  const video = $('#scan-video');
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }, audio: false
    });
  } catch (e) {
    toast('Camera access was blocked — allow it to scan barcodes');
    return;
  }
  video.srcObject = scanStream;
  try {
    await video.play();
  } catch (e) {
    toast('Could not start the camera preview — try again');
    closeScanner();
    return;
  }
  dlg.showModal();
  const detector = new BarcodeDetector({ formats: BARCODE_FORMATS });
  const tick = async () => {
    if (!scanStream) return;
    try {
      const codes = await detector.detect(video);
      if (codes.length) {
        const value = codes[0].rawValue;
        const frame = options && options.captureFrame ? canvasFromVideo(video) : null;
        closeScanner();
        onCode(value, frame);
        return;
      }
    } catch (e) { /* keep trying */ }
    if (scanStream) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function canvasFromVideo(video) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, video.videoWidth || 640);
  canvas.height = Math.max(1, video.videoHeight || 480);
  canvas.getContext('2d').drawImage(video, 0, 0);
  return canvas;
}

function canvasToFile(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) { resolve(null); return; }
      resolve(new File([blob], 'jug-scan.jpg', { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.9);
  });
}

function emptyMixRow() {
  const rows = $$('#app-products .app-product-row');
  const empty = rows.find(r => !r.querySelector('.apr-product').value);
  const row = empty || addAppProductRow();
  row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return row;
}

function selectMixProduct(product) {
  const row = emptyMixRow();
  row.classList.remove('is-compact');
  const details = row.querySelector('.apr-show-details');
  const line = row.querySelector('.apr-compact-line');
  if (details) details.hidden = true;
  if (line) line.hidden = true;
  row.querySelector('.apr-product').value = product.id;
  onRowProductChange(row);
  const rate = row.querySelector('.apr-rate');
  if (rate) rate.focus();
  toast(`Scanned: ${product.name} — enter the label rate`);
}

let qpVerified = null;

function applyEpaResultToQuickAdd(result, barcode, opts) {
  const jugReg = EpaRank.jugRegNo(result);
  const typed = $('#qp-name').value.trim();
  const typedIsAlt = typed && (result.altBrandNames || []).some(n => EpaRank.fold(n) === EpaRank.fold(typed));
  $('#qp-name').value = (opts && opts.name) || (typedIsAlt ? typed : '') || result.name || '';
  $('#qp-epa').value = jugReg || '';
  $('#qp-ai').value = EpaRank.epaAiText(result);
  $('#qp-rup').checked = !!result.rup;
  if ($('#qp-company')) $('#qp-company').value = EpaRank.jugCompany(result) || '';
  const kind = EpaRank.productTypeOf(result);
  if (kind) $('#qp-type').value = kind;
  syncOmriLink('#qp-omri-check', $('#qp-name').value);
  qpVerified = { ...verifiedFields(result), epaRegNo: jugReg, signalWord: normalizedSignalWord(result.signalWord) };
  if (barcode) {
    $('#qp-barcode').value = barcode;
    $('#qp-barcode-hint').hidden = false;
    $('#qp-barcode-hint').textContent = `Linking scanned barcode ${barcode} to this product for next time.`;
  }
  const host = $('#qp-epa-results');
  const alts = (result.altBrandNames || []).filter(n => EpaRank.fold(n) !== EpaRank.fold(result.name));
  if (host) {
    host.innerHTML = alts.length
      ? `<p class="card-hint">${esc(tr('Name on your jug different? Also sold as'))}:</p>` +
        alts.map((n, i) => `<button type="button" class="qp-epa-pick" data-qp-alt="${i}"><strong>${esc(n)}</strong></button>`).join('')
      : '';
    host.querySelectorAll('[data-qp-alt]').forEach((button) => {
      button.addEventListener('click', () => {
        $('#qp-name').value = alts[Number(button.dataset.qpAlt)];
        syncOmriLink('#qp-omri-check', $('#qp-name').value);
        host.innerHTML = '';
        $('#qp-rei')?.focus();
      });
    });
  }
  const notice = EpaRank.jugNotice(result);
  setQpEpaStatus(notice
    ? tr(notice)
    : tr('Filled from EPA: {name}. Copy REI and PHI from the label, then Save & select.').replace('{name}', result.name));
  const rei = $('#qp-rei');
  if (rei) rei.focus();
}

function setQpEpaStatus(text) {
  const status = $('#qp-epa-status');
  if (status) { status.textContent = text || ''; status.hidden = !text; }
}

let qpEpaSeq = 0;

async function lookupQuickAddEpa(opts) {
  const seq = ++qpEpaSeq;
  dismissToast();
  const barcode = (opts && opts.barcode) || '';
  const host = $('#qp-epa-results');
  if (host) host.innerHTML = '';
  const reg = EpaRank.normalizeRegQuery($('#qp-epa').value);
  const name = $('#qp-name').value.trim();
  if (!reg && name.length < 2) {
    setQpEpaStatus(tr('Type the EPA Reg. No. from the label (it looks like 524-549) or the product name, then Look up.'));
    ($('#qp-epa').value.trim() ? $('#qp-epa') : $('#qp-name')).focus();
    return;
  }
  if (reg) $('#qp-epa').value = reg;
  setQpEpaStatus(reg
    ? tr('Looking up EPA # {reg}…').replace('{reg}', reg)
    : tr('Searching the official EPA database…'));
  try {
    const payload = await fetchEpa(reg ? { reg } : { q: name });
    if (seq !== qpEpaSeq) return;
    const rows = payload.results || [];
    const exact = reg ? rows.filter(r => EpaRank.resultMatchesReg(r, reg)) : [];
    if (reg && (exact.length === 1 || (exact.length > 1 && exact.every(r => r.epaRegNo === exact[0].epaRegNo)))) {
      applyEpaResultToQuickAdd(exact[0], barcode);
      return;
    }
    const list = reg ? (exact.length ? exact : rows) : EpaRank.rankEpaResults(name, rows);
    if (!list.length) {
      setQpEpaStatus(reg
        ? tr('EPA has no product under {reg}. Check the number on the label (it looks like 524-549), or type the rest by hand.').replace('{reg}', reg)
        : tr('No EPA product by that name. Brand names change; the EPA Reg. No. on the label always works.'));
      return;
    }
    const top = list.slice(0, 5);
    setQpEpaStatus(tr('Pick the product that matches your jug:'));
    if (host) {
      host.innerHTML = top.map((r, i) => `<button type="button" class="qp-epa-pick" data-qp-pick="${i}">
            <strong>${esc(r.name)}</strong>
            <span>EPA ${esc(EpaRank.jugRegNo(r))} · ${esc(EpaRank.jugCompany(r) || '')}${r.status && r.status !== 'Active' ? ` · ${esc(r.status)}` : ''}</span>
          </button>`).join('');
      host.querySelectorAll('[data-qp-pick]').forEach((button) => {
        button.addEventListener('click', () => applyEpaResultToQuickAdd(top[Number(button.dataset.qpPick)], barcode));
      });
    }
  } catch (error) {
    if (seq !== qpEpaSeq) return;
    setQpEpaStatus(error.message || tr('EPA lookup is unavailable. You can still enter the product manually.'));
  }
}

async function resolveJugScan(facts) {
  const decision = CameraScan.resolveJugFacts(facts, data.products);
  if (decision.action === 'ambiguous-barcode') {
    toast('Two products share this barcode — pick the right one from the mix');
    return;
  }
  if (decision.action === 'select') {
    if (decision.linkBarcode) {
      decision.product.barcode = decision.barcode;
      save();
    }
    selectMixProduct(decision.product);
    return;
  }
  if (decision.action === 'lookup-epa') {
    const barcode = decision.barcode;
    const row = emptyMixRow();
    openQuickAddProduct(row, barcode);
    $('#qp-epa').value = decision.epaRegNo;
    if (decision.activeIngredientGuess) $('#qp-ai').value = decision.activeIngredientGuess;
    await lookupQuickAddEpa({ barcode });
    return;
  }
  if (decision.action === 'new-barcode') {
    toast('New barcode — add this jug\u2019s product now');
    openQuickAddProduct(emptyMixRow(), decision.barcode);
    return;
  }
  toast('Could not read an EPA number — photograph the EPA Reg. No. line, or type it.');
}

async function onJugLiveScan(code, frameCanvas) {
  const decision = CameraScan.resolveJugFacts({ barcode: code }, data.products);
  if (decision.action === 'select') {
    selectMixProduct(decision.product);
    return;
  }
  if (decision.action === 'ambiguous-barcode') {
    toast('Two products share this barcode — pick the right one from the mix');
    return;
  }
  let facts = { barcode: code };
  if (frameCanvas && ocrSupported()) {
    try {
      const file = await canvasToFile(frameCanvas);
      if (file) {
        toast('Barcode is new — reading the label…');
        const ocr = await captureAndReadLabel(file, status => toast(status));
        facts = Object.assign({ barcode: code }, ocr);
      }
    } catch (e) { /* barcode-only fallback */ }
  }
  await resolveJugScan(facts);
}

async function scanJugPhoto(file) {
  if (!file) return;
  if (ocrSupported()) {
    try {
      const facts = await captureAndReadLabel(file, status => toast(status));
      await resolveJugScan(facts);
      return;
    } catch (e) {
      if (e && e.message !== 'ocr-offline' && e.message !== 'unsupported' && e.message !== 'load-failed') {
        /* try barcode-only below */
      } else {
        toastOcrError(e);
      }
    }
  }
  toast('Reading barcode…');
  try {
    const code = await decodeBarcodeFromFile(file);
    if (!code) {
      toast('Could not read an EPA number — photograph the EPA Reg. No. line, or type it.');
      return;
    }
    await resolveJugScan({ barcode: code });
  } catch (e) {
    toast('Could not read an EPA number — photograph the EPA Reg. No. line, or type it.');
  }
}

function scanJugIntoMix() {
  if (liveBarcodeSupported()) openScanner((code, frame) => { onJugLiveScan(code, frame); }, { captureFrame: true });
  else {
    const input = $('#app-scan-jug-input');
    if (input) input.click();
    else toast('Photograph the barcode, or use Scan label for the EPA Reg. No.');
  }
}

function fileFromInput(input) {
  return CameraScan.fileFromInput(input);
}

function setupBarcodeButton({ liveBtn, photoLabel, photoInput, onCode }) {
  const live = liveBarcodeSupported();
  if (liveBtn) liveBtn.hidden = !live;
  if (photoLabel) photoLabel.hidden = live;
  if (live && liveBtn) {
    liveBtn.addEventListener('click', () => openScanner(onCode));
  }
  if (photoInput) {
    photoInput.addEventListener('change', async () => {
      const file = fileFromInput(photoInput);
      if (!file) return;
      toast('Reading barcode…');
      try {
        const code = await decodeBarcodeFromFile(file);
        if (!code) {
          toast('Could not read a barcode — try a closer, sharper photo of the UPC');
          return;
        }
        onCode(code);
      } catch (e) {
        toast('Could not read a barcode — try again, or type the UPC');
      }
    });
  }
}

function loadZXingScript() {
  if (window.ZXing) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'vendor/zxing/zxing.min.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('zxing-load-failed'));
    document.head.appendChild(s);
  });
}

function imageToCanvas(img, maxDim) {
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, (maxDim || 1600) / Math.max(img.width, img.height));
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function rotateCanvas(src, deg) {
  const canvas = document.createElement('canvas');
  const rad = deg * Math.PI / 180;
  const swap = deg === 90 || deg === 270;
  canvas.width = swap ? src.height : src.width;
  canvas.height = swap ? src.width : src.height;
  const ctx = canvas.getContext('2d');
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rad);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return canvas;
}

function invertCanvas(src) {
  const canvas = document.createElement('canvas');
  canvas.width = src.width;
  canvas.height = src.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'difference';
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

function tryZXingCanvas(canvas, Z) {
  try {
    const hints = new Map();
    hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [
      Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E,
      Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8,
      Z.BarcodeFormat.CODE_128, Z.BarcodeFormat.CODE_39,
      Z.BarcodeFormat.QR_CODE
    ]);
    hints.set(Z.DecodeHintType.TRY_HARDER, true);
    const reader = new Z.MultiFormatReader();
    reader.setHints(hints);
    const source = new Z.HTMLCanvasElementLuminanceSource(canvas);
    const bitmap = new Z.BinaryBitmap(new Z.HybridBinarizer(source));
    const result = reader.decode(bitmap);
    if (!result) return null;
    return result.getText ? result.getText() : result.text;
  } catch (e) {
    return null;
  }
}

async function decodeBarcodeWithZXing(img) {
  await loadZXingScript();
  const Z = window.ZXing;
  if (!Z || !Z.MultiFormatReader) return null;
  const base = imageToCanvas(img, 1600);
  const attempts = [base, rotateCanvas(base, 90), rotateCanvas(base, 180), rotateCanvas(base, 270)];
  for (const canvas of attempts) {
    const text = tryZXingCanvas(canvas, Z) || tryZXingCanvas(invertCanvas(canvas), Z);
    if (text) return String(text).trim();
  }
  return null;
}

async function detectBarcodeInImage(img) {
  if (liveBarcodeSupported()) {
    try {
      const detector = new BarcodeDetector({ formats: BARCODE_FORMATS });
      const codes = await detector.detect(img);
      if (codes.length) return codes[0].rawValue;
    } catch (e) { /* fall through to ZXing */ }
  }
  try {
    return await decodeBarcodeWithZXing(img);
  } catch (e) {
    return null;
  }
}

async function decodeBarcodeFromFile(file) {
  const dataUrl = await compressImage(file, 1900, 0.92);
  const img = await dataUrlToImage(dataUrl);
  return detectBarcodeInImage(img);
}

// ---- OCR label scanning (Tesseract.js, vendored + lazy-loaded on first use) ----
//
// Unlike barcode scanning (a live video loop — see openScanner() above),
// label text needs a single well-focused photo: the phone's native camera
// app (autofocus, flash, HDR) reads small print far more reliably than a
// raw getUserMedia frame grab. The file input lives in the page so iOS
// Safari treats the tap as a real user gesture. Nothing here ever leaves
// the device except the extracted EPA registration number, sent to the
// same /api/epa lookup the manual search box already uses.

let tesseractWorkerPromise = null;
let ocrProgressHandler = null;
let ocrEngineCached = false;

const OCR_ASSETS = [
  'vendor/tesseract/tesseract.min.js',
  'vendor/tesseract/worker.min.js',
  'vendor/tesseract/eng.traineddata.gz',
  'vendor/tesseract/tesseract-core-lstm.wasm.js',
  'vendor/tesseract/tesseract-core-simd-lstm.wasm.js',
  'vendor/tesseract/tesseract-core-relaxedsimd-lstm.wasm.js'
];

function ocrSupported() {
  return typeof WebAssembly !== 'undefined';
}

function ocrEngineReadyOffline() {
  return !!window.Tesseract || ocrEngineCached;
}

async function refreshOcrCacheFlag() {
  if (!('caches' in window)) return;
  try {
    const hit = await caches.match('vendor/tesseract/tesseract.min.js', { ignoreSearch: true });
    if (hit) ocrEngineCached = true;
  } catch (e) { /* private mode / file: */ }
}

function prefetchScanEngines() {
  if (!navigator.onLine) return;
  const conn = navigator.connection;
  if (conn && (conn.saveData || conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g')) return;
  const urls = OCR_ASSETS.concat(['vendor/zxing/zxing.min.js']);
  const run = () => {
    urls.forEach(url => fetch(url).catch(() => {}));
    fetch('vendor/tesseract/tesseract.min.js').then(r => {
      if (r && r.ok) ocrEngineCached = true;
    }).catch(() => {});
  };
  if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 5000 });
  else setTimeout(run, 1200);
}

function loadTesseractScript() {
  if (window.Tesseract) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'vendor/tesseract/tesseract.min.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('load-failed'));
    document.head.appendChild(s);
  });
}

async function getTesseractWorker(onProgress) {
  ocrProgressHandler = typeof onProgress === 'function' ? onProgress : null;
  if (!tesseractWorkerPromise) {
    tesseractWorkerPromise = (async () => {
      await loadTesseractScript();
      return Tesseract.createWorker('eng', 1, {
        workerPath: 'vendor/tesseract/worker.min.js',
        corePath: 'vendor/tesseract/',
        langPath: 'vendor/tesseract',
        gzip: true,
        logger: (m) => {
          if (ocrProgressHandler) ocrProgressHandler(m);
        }
      });
    })();
  }
  return tesseractWorkerPromise;
}

function dataUrlToImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('bad image'));
    img.src = dataUrl;
  });
}

async function captureAndReadLabel(file, onStatus) {
  if (!ocrSupported()) throw new Error('unsupported');
  if (!file) throw new Error('cancelled');
  if (!navigator.onLine && !ocrEngineReadyOffline()) throw new Error('ocr-offline');
  if (onStatus) onStatus('Reading label…');
  const dataUrl = await enhanceLabelImage(file);
  const img = await dataUrlToImage(dataUrl);
  const barcodePromise = detectBarcodeInImage(img);
  const worker = await getTesseractWorker((m) => {
    if (!onStatus) return;
    if (m.status === 'loading language traineddata' || m.status === 'loading tesseract core') {
      onStatus('Downloading a one-time text reader (~7 MB)…');
    } else if (m.status === 'recognizing text') {
      onStatus(`Reading label… ${Math.round((m.progress || 0) * 100)}%`);
    }
  });
  const { data } = await worker.recognize(dataUrl);
  ocrEngineCached = true;
  const facts = LabelOcr.parseLabelText(data.text || '');
  let barcode = null;
  try { barcode = await barcodePromise; } catch (e) { barcode = null; }
  return Object.assign({ barcode }, facts);
}

function toastOcrError(e) {
  if (!e || e.message === 'cancelled') return;
  if (e.message === 'unsupported') toast('Label scanning needs a browser with WebAssembly support');
  else if (e.message === 'load-failed') toast('Could not download the text reader — check your connection and try again');
  else if (e.message === 'ocr-offline') {
    toast('Label scanning needs a one-time download (~7 MB). Connect once, then it works offline.');
  } else toast('Could not read that label — photograph the EPA Reg. No. line in better light, or type it');
}

async function scanProductLabelFromFile(file) {
  if (!ocrSupported()) { toast('Label scanning needs a browser with WebAssembly support'); return; }
  try {
    const facts = await captureAndReadLabel(file, status => toast(status));
    if (facts.signalWord) $('#prod-signal').value = facts.signalWord;
    if (facts.epaRegNo) {
      $('#prod-epa').value = facts.epaRegNo;
      await lookupProductFormEpa();
    } else {
      setProductsMode('epa');
      $('#epa-search-input').value = facts.activeIngredientGuess || '';
      $('#epa-search-input').focus();
      toast('Couldn\u2019t read an EPA registration number — type it from the label and Search EPA');
    }
  } catch (e) {
    toastOcrError(e);
  }
}

async function scanProductLabel() {
  const input = $('#scan-label-input');
  if (input) input.click();
  else toast('Label scanning is not available in this view');
}

async function scanQuickAddProductLabelFromFile(file) {
  if (!ocrSupported()) { toast('Label scanning needs a browser with WebAssembly support'); return; }
  try {
    const facts = await captureAndReadLabel(file, status => toast(status));
    if (facts.barcode) {
      $('#qp-barcode').value = facts.barcode;
      $('#qp-barcode-hint').hidden = false;
      $('#qp-barcode-hint').textContent = `Linking scanned barcode ${facts.barcode} to this product for next time.`;
    }
    if (!facts.epaRegNo) {
      if (facts.activeIngredientGuess) $('#qp-ai').value = facts.activeIngredientGuess;
      toast('Couldn\u2019t read an EPA registration number — fill in the rest manually');
      return;
    }
    $('#qp-epa').value = facts.epaRegNo;
    await lookupQuickAddEpa({ barcode: facts.barcode || '' });
  } catch (e) {
    toastOcrError(e);
  }
}

async function scanQuickAddProductLabel() {
  const input = $('#qp-scan-label-input');
  if (input) input.click();
  else toast('Label scanning is not available in this view');
}

function initCameraCapture() {
  prefetchScanEngines();
  refreshOcrCacheFlag();
  window.addEventListener('online', () => {
    prefetchScanEngines();
    refreshOcrCacheFlag();
  });

  const dlg = $('#scan-dialog');
  if (dlg) dlg.addEventListener('close', stopScanStream);
  if ($('#scan-cancel')) $('#scan-cancel').addEventListener('click', closeScanner);

  [
    'photo-attach-input', 'app-scan-jug-input', 'app-scan-label-input',
    'scan-label-input', 'qp-scan-label-input', 'prod-scan-barcode-input'
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (!CameraScan.inPageFileInputReady(el)) {
      console.warn('[camera] in-page file input missing:', id);
    }
  });

  const photoAttach = $('#photo-attach-input');
  if (photoAttach) {
    photoAttach.addEventListener('change', () => {
      const file = fileFromInput(photoAttach);
      const handler = photoAttachHandler;
      photoAttachHandler = null;
      if (handler && file) handler(file);
    });
  }

  if (ocrSupported()) {
    if ($('#scan-label-row')) $('#scan-label-row').hidden = false;
    if ($('#qp-scan-label-row')) $('#qp-scan-label-row').hidden = false;
    if ($('#app-scan-label-btn')) $('#app-scan-label-btn').hidden = false;
  }
  const mixOcr = $('#app-scan-label-input');
  if (mixOcr) {
    mixOcr.addEventListener('change', async () => {
      const file = fileFromInput(mixOcr);
      if (file) await scanJugPhoto(file);
    });
  }
  const prodOcr = $('#scan-label-input');
  if (prodOcr) {
    prodOcr.addEventListener('change', () => {
      const file = fileFromInput(prodOcr);
      if (file) scanProductLabelFromFile(file);
    });
  }
  const qpOcr = $('#qp-scan-label-input');
  if (qpOcr) {
    qpOcr.addEventListener('change', () => {
      const file = fileFromInput(qpOcr);
      if (file) scanQuickAddProductLabelFromFile(file);
    });
  }

  const jugLive = $('#app-scan-jug');
  const jugPhoto = $('#app-scan-jug-photo');
  const jugInput = $('#app-scan-jug-input');
  const liveJug = liveBarcodeSupported();
  if (jugLive) jugLive.hidden = !liveJug;
  if (jugPhoto) jugPhoto.hidden = liveJug;
  if (liveJug && jugLive) {
    jugLive.addEventListener('click', scanJugIntoMix);
  }
  if (jugInput) {
    jugInput.addEventListener('change', async () => {
      const file = fileFromInput(jugInput);
      if (file) await scanJugPhoto(file);
    });
  }
  setupBarcodeButton({
    liveBtn: $('#prod-scan-barcode'),
    photoLabel: $('#prod-scan-barcode-photo'),
    photoInput: $('#prod-scan-barcode-input'),
    onCode: (code) => {
      $('#prod-barcode').value = code;
      toast('Barcode linked — you can now scan this jug in the spray log');
    }
  });
}
