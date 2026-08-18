/* Public start page: state picker + honest job copy.
 * Loaded by start.html. Require()-able under Node for tests.
 * Does not register a service worker and does not read farm records.
 */
(function (root) {
  'use strict';

  const STATE_NAMES = {
    AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
    CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho',
    IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
    ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
    MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
    NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina',
    ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
    RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas',
    UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia',
    WI: 'Wisconsin', WY: 'Wyoming'
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function codeFromLocation(search, hash) {
    const q = String(search || '');
    const h = String(hash || '').replace(/^#/, '');
    let m = /[?&]state=([A-Za-z]{2})/.exec(q);
    if (m) return m[1].toUpperCase();
    if (/^[A-Za-z]{2}$/.test(h)) return h.toUpperCase();
    return '';
  }

  function classFromLocation(search) {
    const m = /[?&](?:class|applicatorClass)=(private|commercial|both)\b/i.exec(String(search || ''));
    return m ? m[1].toLowerCase() : '';
  }

  function loggerHandoffHref(code, applicatorClass) {
    const cls = applicatorClass || 'private';
    if (!code) return 'index.html';
    return 'index.html?state=' + encodeURIComponent(code) + '&class=' + encodeURIComponent(cls);
  }

  function sharePath(code, applicatorClass) {
    const cls = applicatorClass || 'private';
    if (!code) return '?';
    return '?state=' + encodeURIComponent(code) + '&class=' + encodeURIComponent(cls);
  }

  function privateDutyNote(law, applicatorClass) {
    const duty = (law && law.privateDuty) || 'required';
    const cls = applicatorClass || 'private';
    if (cls === 'private' && duty === 'none') {
      return 'This state does not encode a private-applicator record duty. The log stays quiet on those boxes. Confirm with the agency.';
    }
    if (duty === 'uncertain' && cls === 'private') {
      return 'Private-applicator duty is not verified here. Confirm with the agency before you treat the log as complete.';
    }
    return '';
  }

  // Same names as compliance.js COMMERCIAL_ONLY_FIELDS — start.html does not
  // load the engine. Private growers should not see for-hire boxes here.
  const COMMERCIAL_ONLY_FIELDS = [
    'business_name_address', 'company_license',
    'customer_copy_provided', 'customer_copy_date'
  ];

  function summarizeLaw(law, applicatorClass, code) {
    const cls = applicatorClass || 'private';
    const duty = (law && law.privateDuty) || 'required';
    const quiet = cls === 'private' && duty === 'none';
    const fields = (law && law.fields) || [];
    const labels = quiet
      ? []
      : fields.filter((f) => f && f.required &&
        !(cls === 'private' && COMMERCIAL_ONLY_FIELDS.indexOf(f.name) >= 0))
        .map((f) => f.label).filter(Boolean);
    const ver = (law && law.verification) || '';
    const holes = [];
    if (ver === 'uncertain') holes.push('Field list is uncertain — confirm with the agency.');
    const dutyNote = privateDutyNote(law, cls);
    if (dutyNote) holes.push(dutyNote);
    return {
      code: code || '',
      name: STATE_NAMES[code] || code || '',
      agency: (law && law.agency) || '',
      citationRef: law && law.citation && law.citation.reference ? law.citation.reference : '',
      citationUrl: law && law.citation && law.citation.url ? law.citation.url : '',
      retentionYears: law && law.retentionYears != null ? law.retentionYears : null,
      verification: ver,
      privateDuty: duty,
      quiet: !!quiet,
      requiredLabels: labels,
      holes: holes,
      applicatorClass: cls
    };
  }

  function renderSummary(el, summary) {
    if (!el) return;
    if (!summary || !summary.agency) {
      el.innerHTML = '<p class="card-hint">Pick your state. The log reshapes to that state’s boxes — not a generic federal form.</p>';
      return;
    }
    const holeHtml = (summary.holes || []).map((h) =>
      `<p class="card-hint start-hole">${esc(h)}</p>`).join('');
    const labels = summary.quiet
      ? '<p class="card-hint">No private-applicator field list is applied.</p>'
      : (summary.requiredLabels.length
        ? `<ul class="start-fields">${summary.requiredLabels.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`
        : '<p class="card-hint">Required boxes load in the logger after you pick this state.</p>');
    const cite = summary.citationUrl
      ? `<a href="${esc(summary.citationUrl)}" rel="noopener noreferrer">${esc(summary.citationRef || 'Open citation')}</a>`
      : esc(summary.citationRef);
    const retain = summary.retentionYears != null
      ? `Keep records ${esc(summary.retentionYears)} year(s).`
      : '';
    el.innerHTML = `
      <h3 class="card-title">${esc(summary.name)} pesticide application records</h3>
      <p>${esc(summary.agency)}</p>
      <p class="card-hint">${cite}${retain ? ' · ' + retain : ''} · ${esc(summary.verification || 'status unknown')}</p>
      ${holeHtml}
      <p class="card-hint">What the log asks. Completion means fields are filled — not a legal determination. The label is the law.</p>
      ${labels}
      <p class="form-actions"><a class="btn btn-primary" href="${esc(loggerHandoffHref(summary.code, summary.applicatorClass))}">Open the logger in ${esc(summary.name)}</a></p>`;
  }

  function fillStateSelect(sel, selected) {
    if (!sel) return;
    const keep = sel.querySelector('option[value=""]');
    sel.innerHTML = '';
    if (keep) sel.appendChild(keep);
    Object.keys(STATE_NAMES).sort((a, b) => STATE_NAMES[a].localeCompare(STATE_NAMES[b]))
      .forEach((code) => {
        const o = document.createElement('option');
        o.value = code;
        o.textContent = STATE_NAMES[code];
        sel.appendChild(o);
      });
    if (selected && STATE_NAMES[selected]) sel.value = selected;
  }

  function bindStartPage(doc, laws) {
    const documentRef = doc || (typeof document !== 'undefined' ? document : null);
    const matrix = laws || (typeof STATE_LAWS !== 'undefined' ? STATE_LAWS : {});
    if (!documentRef) return;
    const sel = documentRef.getElementById('start-state');
    const clsSel = documentRef.getElementById('start-class');
    const out = documentRef.getElementById('start-state-out');
    const initial = codeFromLocation(
      typeof location !== 'undefined' ? location.search : '',
      typeof location !== 'undefined' ? location.hash : ''
    );
    const initialClass = classFromLocation(
      typeof location !== 'undefined' ? location.search : ''
    );
    fillStateSelect(sel, initial);
    if (clsSel && (initialClass === 'private' || initialClass === 'commercial')) {
      clsSel.value = initialClass;
    }
    function syncHandoffLinks(code, cls) {
      const href = loggerHandoffHref(code, cls);
      const header = documentRef.getElementById('start-open-header');
      const tryBtn = documentRef.getElementById('start-try');
      if (header) header.setAttribute('href', href);
      if (tryBtn) tryBtn.setAttribute('href', href);
      const copyBtn = documentRef.getElementById('start-copy-link');
      if (copyBtn) copyBtn.hidden = !code;
    }
    function paint() {
      const code = sel && sel.value;
      const cls = (clsSel && clsSel.value) || 'private';
      const law = code && matrix[code];
      const summary = law ? summarizeLaw(law, cls, code) : null;
      renderSummary(out, summary);
      syncHandoffLinks(code, cls);
      if (typeof history !== 'undefined' && history.replaceState && code) {
        history.replaceState(null, '', sharePath(code, cls));
      }
    }
    const copyBtn = documentRef.getElementById('start-copy-link');
    if (copyBtn && !copyBtn.dataset.bound) {
      copyBtn.dataset.bound = '1';
      copyBtn.addEventListener('click', () => {
        const code = sel && sel.value;
        const cls = (clsSel && clsSel.value) || 'private';
        if (!code) return;
        const url = (typeof location !== 'undefined' ? location.origin + location.pathname : '') + sharePath(code, cls);
        const done = () => { copyBtn.textContent = 'Copied — send this to a neighbor'; };
        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(done).catch(() => {});
        }
      });
    }
    if (sel) sel.addEventListener('change', paint);
    if (clsSel) clsSel.addEventListener('change', paint);
    if (initial) paint();
    else renderSummary(out, null);
  }

  const SUPPORT_EMAIL = 'kylespear88@gmail.com';

  const api = {
    STATE_NAMES,
    COMMERCIAL_ONLY_FIELDS,
    SUPPORT_EMAIL,
    codeFromLocation,
    classFromLocation,
    loggerHandoffHref,
    sharePath,
    privateDutyNote,
    summarizeLaw,
    fillStateSelect,
    renderSummary,
    bindStartPage
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StartPage = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

if (typeof document !== 'undefined') {
  function startPageGo() {
    if (typeof I18n !== 'undefined' && I18n.bindPublicLanguage) I18n.bindPublicLanguage(document);
    if (typeof StartPage !== 'undefined') StartPage.bindStartPage(document);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startPageGo);
  else startPageGo();
}
