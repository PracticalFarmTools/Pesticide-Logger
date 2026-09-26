/* Pesticide Logger — Reports: filters, inspector packet, CSV, binder, WPS sheet. */
'use strict';

// -------------------------------------------------------------- reports

function renderReportFilters() {
  renderProductOptions();
  renderFieldOptions();
  updateReportCount();
}

function reportApps() {
  const from = $('#report-from').value;
  const to = $('#report-to').value;
  const fieldId = $('#report-field').value;
  const productId = $('#report-product').value;
  const includeDeleted = !!( $('#report-include-deleted') && $('#report-include-deleted').checked );
  return sortedApps(includeDeleted).filter(a =>
    (!from || a.date >= from) &&
    (!to || a.date <= to) &&
    (!fieldId || a.fieldId === fieldId) &&
    (!productId || (a.products || []).some(pr => pr.productId === productId))
  ).reverse(); // oldest first for reports
}

function updateReportCount() {
  $('#report-count').textContent = plural(reportApps().length, '1 record matches the current filter.', '{n} records match the current filter.');
}

function initReports() {
  ['#report-from', '#report-to', '#report-field', '#report-product', '#report-include-deleted']
    .forEach(sel => {
      const el = $(sel);
      if (!el) return;
      el.addEventListener('input', updateReportCount);
      el.addEventListener('change', updateReportCount);
    });
  ['#report-field-filter', '#report-product-filter'].forEach((sel) => {
    const el = $(sel);
    if (!el) return;
    el.addEventListener('input', () => {
      if (sel === '#report-field-filter') renderFieldOptions();
      else renderProductOptions();
      updateReportCount();
    });
  });
  $('#report-csv').addEventListener('click', downloadCsv);
  $('#report-print').addEventListener('click', printReport);
  if ($('#report-state-pack')) $('#report-state-pack').addEventListener('click', downloadStatePack);
  if ($('#report-certifier')) $('#report-certifier').addEventListener('click', printCertifierPacket);
  if ($('#report-inspect-html')) $('#report-inspect-html').addEventListener('click', downloadInspectPacket);
  if ($('#report-season-binder')) $('#report-season-binder').addEventListener('click', printSeasonBinder);
  if ($('#dash-clerk-binder')) $('#dash-clerk-binder').addEventListener('click', printSeasonBinder);
  $('#backup-download').addEventListener('click', downloadBackup);
  if ($('#backup-restore-card')) $('#backup-restore-card').addEventListener('click', printRestoreCard);
  if ($('#settings-download-backup')) $('#settings-download-backup').addEventListener('click', downloadBackup);
  $('#backup-restore').addEventListener('change', restoreBackup);
  $('#data-clear').addEventListener('click', clearAllData);

  const shareBtn = $('#backup-share');
  if (navigator.share && navigator.canShare &&
      navigator.canShare({ files: [new File(['x'], 'x.json', { type: 'application/json' })] })) {
    shareBtn.hidden = false;
    shareBtn.addEventListener('click', shareBackup);
  }
  $('#backup-banner-download').addEventListener('click', downloadBackup);
  const ackIosStorage = () => {
    try { localStorage.setItem(IOS_STORAGE_DISMISSED_KEY, new Date().toISOString()); } catch (e) { /* */ }
  };
  if ($('#ios-storage-download')) $('#ios-storage-download').addEventListener('click', () => {
    ackIosStorage();
    downloadBackup();
  });
  if ($('#ios-storage-dismiss')) $('#ios-storage-dismiss').addEventListener('click', () => {
    ackIosStorage();
    renderIosStorageBanner();
    renderKeepBook();
    renderBackupBanner();
    renderSendNagBanner();
    renderGatherHint();
    renderInstallBanner();
  });
  if ($('#backup-banner-restore-card')) {
    $('#backup-banner-restore-card').addEventListener('click', printRestoreCard);
  }
  $('#backup-banner-snooze').addEventListener('click', () => {
    data.meta.backupSnoozeUntil = Date.now() + 7 * 86400000;
    save();
    renderBackupBanner();
  });
  if ($('#send-nag-send')) $('#send-nag-send').addEventListener('click', () => {
    if (!data.settings.deviceRole) setDeviceRole('cab');
    if ($('#backup-share') && !$('#backup-share').hidden) shareBackup();
    else downloadBackup({ sent: true });
  });
  if ($('#send-nag-snooze')) $('#send-nag-snooze').addEventListener('click', () => {
    data.meta.sendNagSnoozeUntil = Date.now() + 7 * 86400000;
    save();
    renderSendNagBanner();
  });
  if ($('#send-nag-solo')) $('#send-nag-solo').addEventListener('click', () => {
    setDeviceRole('solo');
    toast('Only this device — download a backup and print the restore card.');
  });

  if ($('#auto-backup-connect')) {
    $('#auto-backup-connect').addEventListener('click', connectAutoBackup);
    $('#auto-backup-resume').addEventListener('click', reauthorizeAutoBackup);
    $('#auto-backup-disconnect').addEventListener('click', disconnectAutoBackup);
    renderAutoBackupUI();
  }
}

function csvEscape(v) {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function downloadCsv(apps) {
  apps = apps || reportApps();
  if (!apps.length) { toast('No records match the filter'); return; }
  const header = [
    'Record ID', 'Compliance Status', 'Compliance Complete', 'Draft', 'Deleted',
    'Frozen State', 'Frozen Applicator Class', 'Date', 'Start', 'End',
    'Brand/Product Name', 'EPA Reg No', 'Active Ingredient', 'Manufacturer', 'Formulation', 'State Reg No',
    'RUP', 'OMRI', 'Lot/Batch', 'EPA Status', 'EPA Label URL',
    'Field/Site', 'Location', 'Location Note', 'County', 'Site ID', 'Permit/Operator ID',
    'Crop/Commodity', 'Target Pest', 'Purpose',
    'Area Treated', 'Area Unit', 'Rate', 'Rate Unit',
    'Total Applied', 'Total Unit', 'Carrier Volume', 'Carrier Unit', 'Dilution', 'Concentration',
    'Wind Speed (mph)', 'Wind Direction', 'Temperature (F)', 'Sky/Humidity',
    'Boom Height', 'Ground Speed', 'Buffer Distance', 'Inversion Suspected', 'Sensitive Sites',
    'Method/Equipment', 'Nozzle', 'Pressure', 'Equipment ID', 'Aircraft ID', 'Mix/Load Location',
    'Applicator', 'Certification No', 'Supervisor', 'Noncertified Applicator',
    'Owner/Operator', 'Customer', 'Customer Address', 'Customer Phone',
    'Customer Copy Provided', 'Customer Copy Date', 'Customer Copy Due At', 'Record Due At',
    'Business', 'Company License', 'Supplier', 'Disposal',
    'Product REI (hours)', 'Product PHI (days)', 'Mix REI (hours)', 'Mix PHI (days)',
    'Retention Years', 'Missing Fields', 'Warnings', 'History Edits', 'Notes'
  ];
  const lines = [header.join(',')];
  apps.forEach(a => {
    const result = evaluateCompliance(a);
    (a.products || []).forEach(pr => {
      lines.push([
        a.id.slice(0, 8), result.status, result.complete ? 'Yes' : 'No', a.draft ? 'Yes' : 'No', a.deletedAt ? 'Yes' : 'No',
        a.complianceState || '', a.complianceApplicatorClass || '',
        a.date, a.startTime, a.endTime,
        pr.productName, pr.epaRegNo, pr.activeIngredient, pr.epaCompany || '', pr.type || '', pr.stateRegNo || '',
        pr.rup ? 'Yes' : 'No', pr.omri ? 'Yes' : 'No', pr.lotNumber || '', pr.epaStatus || '', pr.epaLabelUrl || '',
        a.fieldName, a.fieldLocation, a.locationNote || '', a.county || '', a.siteId || '', a.permitNumber || '',
        a.crop, a.targetPest, a.applicationPurpose || '',
        a.area, a.areaUnit, pr.rate ?? '', pr.rateUnit,
        pr.total ?? '', pr.totalUnit, a.carrier ?? '', a.carrierUnit, a.dilution, a.concentration || '',
        a.windSpeed ?? '', a.windDir, a.temperature ?? '', a.sky,
        a.boomHeight || '', a.groundSpeed || '', a.bufferDistance || '', a.inversionObserved ? 'Yes' : 'No', a.sensitiveSites || '',
        a.method, a.nozzleType || '', a.sprayerPressure || '', a.equipmentId || '', a.aircraftId || '', a.mixLoadLocation || '',
        a.applicatorName, a.certNumber, a.supervisorName || '', a.noncertifiedApplicatorName || '',
        a.ownerOperatorName || '', a.customerName || '', a.customerAddress || '', a.customerPhone || '',
        a.customerCopyProvided ? 'Yes' : 'No', a.customerCopyDate || '', computeCustomerCopyDueAt(a) || '',
        recordDueFor(a) || '',
        a.businessNameAddress || '', a.companyLicense || '', a.pesticideSupplier || '', a.disposalMethod || '',
        pr.reiHours ?? '', pr.phiDays ?? '', a.reiHours ?? '', a.phiDays ?? '', result.retentionYears,
        result.missing.join('; '), (result.warnings || []).join('; '), (a.history || []).length, a.notes
      ].map(csvEscape).join(','));
    });
  });
  const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, `pesticide-records-${new Date().toISOString().slice(0, 10)}.csv`);
  toast(`Exported ${countOf(apps.length, 'record')} to CSV`);
}

function reportPeriodLabel() {
  const from = $('#report-from') && $('#report-from').value;
  const to = $('#report-to') && $('#report-to').value;
  return from || to
    ? `${from ? fmtDate(from) : 'start'} – ${to ? fmtDate(to) : 'today'}`
    : 'All records';
}

async function buildReportInspectPayload(apps, photos) {
  return FarmFile.buildInspectPayload({
    farm: data,
    records: apps,
    photos: photos || [],
    generatedAt: new Date().toISOString(),
    period: reportPeriodLabel(),
    stateName: STATE_NAMES[data.settings.state] || '',
    evaluateCompliance: evaluateCompliance,
    stateLaws: typeof STATE_LAWS !== 'undefined' ? STATE_LAWS : {},
    matrixEdition: typeof STATE_LAWS_RESEARCH_DATE !== 'undefined' ? STATE_LAWS_RESEARCH_DATE : ''
  });
}

async function printReport() {
  const apps = reportApps();
  if (!apps.length) { toast('No records match the filter'); return; }
  const incomplete = apps.filter(a => !evaluateCompliance(a).complete);
  if (incomplete.length && !confirm(`${countOf(incomplete.length, 'record')} ${incomplete.length === 1 ? 'is' : 'are'} missing required state fields. Print anyway?`)) return;
  if (typeof FarmFile === 'undefined' || !FarmFile.buildInspectPayload) {
    toast('Inspector packet is unavailable in this build');
    return;
  }
  try {
    const photos = await idbPhotosGetAll();
    const payload = await buildReportInspectPayload(apps, photos);
    const usedIds = new Set();
    apps.forEach((a) => (a.photoIds || []).forEach((id) => usedIds.add(String(id))));
    const usedPhotos = (photos || []).filter((p) => usedIds.has(String(p.id)));
    $('#print-area').innerHTML = FarmFile.inspectPacketInnerHtml(payload, {
      photos: usedPhotos,
      showVerify: false,
      mark: ''
    });
    window.print();
  } catch (err) {
    toast('Could not build the inspection report');
  }
}

// Certifier / buyer packet: the same records, shaped the way organic
// certifiers and GAP auditors ask for them — materials list + per-crop log.
function printCertifierPacket() {
  const apps = reportApps();
  if (!apps.length) { toast('No records match the filter'); return; }
  const s = data.settings;
  const from = $('#report-from').value, to = $('#report-to').value;
  const range = from || to ? `${from ? fmtDate(from) : 'start'} – ${to ? fmtDate(to) : 'today'}` : 'All records';

  // Materials list: unique products used in the filtered range.
  const materials = new Map();
  apps.forEach(a => (a.products || []).forEach(p => {
    const key = p.productId || (p.productName + '|' + p.epaRegNo);
    if (!materials.has(key)) {
      const lib = getProduct(p.productId);
      materials.set(key, {
        name: p.productName, epaRegNo: p.epaRegNo,
        ai: p.activeIngredient || (lib && lib.activeIngredient) || '',
        omri: !!(p.omri || (lib && lib.omri)),
        omriCheckedAt: (lib && lib.omri && lib.omriCheckedAt) || '',
        rup: !!p.rup,
        uses: 0
      });
    }
    materials.get(key).uses++;
  }));
  const matRows = Array.from(materials.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(m => `
        <tr>
          <td>${esc(m.name)}${m.rup ? ' <strong>(RUP)</strong>' : ''}</td>
          <td>${esc(m.epaRegNo)}</td>
          <td>${esc(m.ai)}</td>
          <td>${m.omri ? `OMRI Listed (per farm records${m.omriCheckedAt ? ', marked ' + esc(fmtDate(m.omriCheckedAt.slice(0, 10))) : ''})` : '—'}</td>
          <td>${m.uses}</td>
        </tr>`).join('');

  // Application log grouped by crop.
  const byCrop = {};
  apps.forEach(a => { (byCrop[a.crop || '(no crop)'] = byCrop[a.crop || '(no crop)'] || []).push(a); });
  const cropSections = Object.keys(byCrop).sort().map(crop => {
    const rows = byCrop[crop].map(a => {
      const clear = Compliance.phiDate(a);
      return `
        <tr>
          <td>${fmtDate(a.date)}</td>
          <td>${(a.products || []).map(p => `${esc(p.productName)}${p.lotNumber ? ` (lot ${esc(p.lotNumber)})` : ''}`).join('<br>')}</td>
          <td>${(a.products || []).map(p => p.rate != null ? `${fmtNum(p.rate)} ${esc(p.rateUnit)}` : '—').join('<br>')}</td>
          <td>${(a.products || []).map(p => fmtAmount(p.total, p.totalUnit)).join('<br>')}</td>
          <td>${esc(a.fieldName)} · ${fmtNum(a.area)} ${a.areaUnit === 'sqft' ? 'sq ft' : a.areaUnit === '1000sqft' ? '×1,000 sq ft' : 'ac'}</td>
          <td>${a.phiDays != null ? fmtNum(a.phiDays) + ' d' : '—'}</td>
          <td>${clear ? clear.toLocaleDateString() : 'unknown'}</td>
          <td>${esc(a.applicatorName)}</td>
        </tr>`;
    }).join('');
    return `
        <h2>${esc(crop)}</h2>
        <table>
          <thead><tr><th>Date</th><th>Product / lot</th><th>Rate</th><th>Total</th><th>Field / area</th><th>PHI</th><th>Earliest harvest</th><th>Applicator</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
  }).join('');

  $('#print-area').innerHTML = `
      <h1>Spray Materials &amp; Application Log — Certifier / Buyer Packet</h1>
      <p class="print-meta">
        ${esc(s.farmName || 'Farm')}${s.county ? ` · ${esc(s.county)} County` : ''}${s.state ? `, ${esc(STATE_NAMES[s.state] || s.state)}` : ''}
        · Period: ${range} · ${countOf(apps.length, 'application')} · Generated ${now().toLocaleString()} by Pesticide Logger
      </p>
      <h2>Materials used in this period</h2>
      <table>
        <thead><tr><th>Product</th><th>EPA Reg #</th><th>Active ingredient</th><th>Organic status</th><th>Applications</th></tr></thead>
        <tbody>${matRows}</tbody>
      </table>
      ${cropSections}
      <div class="sig-line"><span>Grower signature / date</span><span>Reviewer / date</span></div>
      <p class="print-footer">
        OMRI status reflects the grower's product records — verify against the current OMRI list and your
        certifier's approved-materials process. PHI "earliest harvest" dates derive from entered label PHI
        values and are not a legal determination. The product label is the law.
      </p>`;
  window.print();
}

function downloadStatePack() {
  const apps = reportApps();
  const s = data.settings;
  const law = stateLaw();
  if (!s.state || !law) {
    toast('Select a state in Settings before downloading a state compliance pack');
    return;
  }
  const matrix = (law.fields || []).map(f => {
    const row = {
      name: f.name,
      label: f.label,
      required: !!f.required,
      type: f.type || 'string'
    };
    if (Array.isArray(f.classes) && f.classes.length) row.classes = f.classes;
    return row;
  });
  const records = apps.map(a => {
    const result = evaluateCompliance(a);
    return {
      id: a.id,
      date: a.date,
      products: a.products,
      fieldName: a.fieldName,
      crop: a.crop,
      draft: !!a.draft,
      deletedAt: a.deletedAt || null,
      customerCopyProvided: !!a.customerCopyProvided,
      customerCopyDate: a.customerCopyDate || '',
      customerCopyDueAt: computeCustomerCopyDueAt(a),
      recordDueAt: recordDueFor(a),
      boomHeight: a.boomHeight || '',
      groundSpeed: a.groundSpeed || '',
      bufferDistance: a.bufferDistance || '',
      inversionObserved: !!a.inversionObserved,
      sensitiveSites: a.sensitiveSites || '',
      compliance: {
        status: result.status,
        complete: result.complete,
        intervalsOk: result.intervalsOk,
        missing: result.missing,
        warnings: result.warnings,
        retentionYears: result.retentionYears,
        frozenState: a.complianceState,
        frozenClass: a.complianceApplicatorClass
      },
      history: (a.history || []).map(h => ({
        at: h.at,
        date: h.snapshot && h.snapshot.date,
        products: h.snapshot && appProductsLabel(h.snapshot),
        draft: !!(h.snapshot && h.snapshot.draft),
        deletedAt: h.snapshot && h.snapshot.deletedAt
      })),
      snapshot: a
    };
  });
  const pack = {
    format: 'pesticide-logger-state-pack',
    version: 5,
    generatedAt: new Date().toISOString(),
    app: 'Pesticide Logger — Practical Farm Tools',
    disclaimer: 'Completion means required fields are filled for this context — not a legal determination. Does not replace WPS duties or e-filing programs.',
    farm: {
      name: s.farmName || '',
      state: s.state,
      stateName: STATE_NAMES[s.state] || s.state,
      county: s.county || '',
      applicatorClass: s.applicatorClass || 'private'
    },
    stateLaw: {
      agency: law.agency,
      citation: law.citation,
      retentionYears: law.retentionYears,
      appliesTo: law.appliesTo,
      verification: law.verification,
      notes: law.notes,
      recordWithinHours: law.recordWithinHours,
      recordDeadline: law.recordDeadline || null,
      customerCopyDays: law.customerCopyDays,
      privateDuty: law.privateDuty || 'required',
      requiredFieldMatrix: matrix
    },
    filter: {
      from: $('#report-from').value || null,
      to: $('#report-to').value || null,
      fieldId: $('#report-field').value || null,
      productId: $('#report-product').value || null
    },
    summary: {
      recordCount: records.length,
      incomplete: records.filter(r => !r.compliance.complete || r.draft).length,
      needsReview: records.filter(r => r.compliance.status === 'needs_review').length,
      copyMissing: records.filter(r => r.customerCopyDueAt && !r.customerCopyProvided).length
    },
    records
  };
  const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
  const stamp = new Date().toISOString().slice(0, 10);
  triggerDownload(blob, `state-compliance-pack-${s.state}-${stamp}.json`);
  toast(`State pack exported for ${STATE_NAMES[s.state] || s.state} (${countOf(records.length, 'record')})`);
}
