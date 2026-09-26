/* Pesticide Logger — REI posting and reminders. */
'use strict';

// -------------------------------------------------------------- REI posting & reminders

// Bilingual treated-area posting aid. NOT an official WPS warning sign —
// WPS-covered establishments must use the EPA-required sign where posting
// is mandated. This sheet is for extra on-farm communication.
function printReiPosting(appId) {
  const a = data.applications.find(x => x.id === appId);
  if (!a) return;
  const exp = Compliance.reiExpiry(a);
  const s = data.settings;
  $('#print-area').innerHTML = `
      <div class="posting-sheet">
        <h1 class="posting-head">DO NOT ENTER · NO ENTRE</h1>
        <h2 class="posting-sub">Pesticide-treated area · Área tratada con pesticidas</h2>
        <table>
          <tr><th>Field / area · Campo</th><td>${esc(a.fieldName || '')}${a.fieldLocation ? ` — ${esc(a.fieldLocation)}` : ''}</td></tr>
          <tr><th>Product(s) · Producto(s)</th><td>${(a.products || []).map(p =>
          `${esc(p.productName)} (EPA ${esc(p.epaRegNo)})`).join('<br>')}</td></tr>
          <tr><th>Applied · Aplicado</th><td>${fmtDate(a.date)}${a.startTime ? ` ${esc(a.startTime)}` : ''}${a.endTime ? `–${esc(a.endTime)}` : ''}</td></tr>
          <tr><th>Re-entry after · Reingreso después de</th>
            <td class="posting-when">${exp
            ? exp.toLocaleString(undefined, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
            : 'REI unknown — follow the label / REI desconocido — siga la etiqueta'}</td></tr>
          <tr><th>Contact · Contacto</th><td>${esc(s.farmName || '')}${s.applicatorName ? ` — ${esc(s.applicatorName)}` : ''}</td></tr>
        </table>
        <p class="print-footer">Posting aid from Pesticide Logger — not the official EPA WPS warning sign.
          Where WPS posting is required, use the EPA-specified sign and follow 40 CFR Part 170.
          The product label is the law. · La etiqueta del producto es la ley.</p>
      </div>`;
  window.print();
}

// Local reminders: fires only while the app is open (no server, no push).
function reminderEvents() {
  const events = [];
  const t = now();
  sortedApps().forEach(a => {
    const rei = Compliance.reiExpiry(a);
    if (rei) {
      const dh = (rei - t) / 3600000;
      if (dh > 0 && dh <= 1) {
        events.push({ key: `rei-soon-${a.id}`, title: 'REI ends within an hour',
          body: `${a.fieldName}: re-entry allowed after ${rei.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} (${appProductsLabel(a)})` });
      } else if (dh <= 0 && dh > -12) {
        events.push({ key: `rei-clear-${a.id}`, title: 'Re-entry interval complete',
          body: `${a.fieldName} cleared REI at ${rei.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })} — follow label PPE rules for early entry exceptions` });
      }
    }
    const phi = Compliance.phiDate(a);
    if (phi) {
      const dd = Math.floor((phi - t) / 86400000);
      if (dd === 0 || (phi <= t && t - phi < 86400000)) {
        events.push({ key: `phi-clear-${a.id}-${a.date}`, title: 'Earliest harvest date reached',
          body: `${a.crop || a.fieldName}: PHI complete for ${appProductsLabel(a)} sprayed ${fmtDate(a.date)}` });
      }
    }
  });
  return events;
}

function checkReminders() {
  if (!data.meta.remindersEnabled) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const seen = data.meta.notifiedEvents || {};
  let changed = false;
  reminderEvents().forEach(ev => {
    if (seen[ev.key]) return;
    try {
      new Notification(tr(ev.title), { body: ev.body, icon: 'icon-192.png', tag: ev.key });
      seen[ev.key] = Date.now();
      changed = true;
    } catch (e) { /* notification constructor can throw on some platforms */ }
  });
  // Prune entries older than 30 days so meta stays small.
  Object.keys(seen).forEach(k => { if (Date.now() - seen[k] > 30 * 86400000) { delete seen[k]; changed = true; } });
  if (changed) { data.meta.notifiedEvents = seen; save(); }
}

function initReminders() {
  const box = $('#set-reminders');
  if (!box) return;
  if (!('Notification' in window)) {
    $('#reminders-hint').textContent = 'This browser does not support notifications — REI/PHI clocks on the dashboard still work.';
    box.disabled = true;
    return;
  }
  box.checked = !!data.meta.remindersEnabled && Notification.permission === 'granted';
  box.addEventListener('change', async () => {
    if (box.checked) {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        box.checked = false;
        toast('Notifications were blocked — enable them in browser settings');
        return;
      }
      data.meta.remindersEnabled = true;
      save();
      toast('Reminders on — you’ll get REI/PHI alerts while the app is open');
      checkReminders();
    } else {
      data.meta.remindersEnabled = false;
      save();
    }
  });
}
