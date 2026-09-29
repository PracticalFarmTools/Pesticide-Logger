/* Pesticide Logger — spray work orders.
 * The shop saves a tank mix as a plan and sends a file. The cab phone
 * fills the spray log from that plan. Only Save creates a record.
 */
'use strict';

function renderPlanStrip() {
  const el = $('#plan-strip');
  if (!el || typeof WorkOrder === 'undefined') return;
  const open = WorkOrder.openPlans(data.plans);
  el.hidden = !open.length;
  el.innerHTML = open.map((p) => {
    const names = ((p.mix && p.mix.products) || []).map((x) => x.name).filter(Boolean).join(' + ') || tr('Work order');
    const when = p.targetDate ? ' · ' + fmtDate(p.targetDate) : '';
    return `<button type="button" class="chip" data-plan="${esc(p.id)}">${esc((p.fieldName || tr('Field')) + ' · ' + names + when)}</button>`;
  }).join('');
  el.querySelectorAll('[data-plan]').forEach((b) =>
    b.addEventListener('click', () => startFromPlan(b.dataset.plan)));
}

function startFromPlan(id) {
  const plan = (data.plans || []).find((p) => p.id === id);
  if (!plan || !WorkOrder.isOpen(plan)) {
    toast('That work order is already finished');
    renderPlanStrip();
    return;
  }
  const mix = plan.mix || {};
  const library = (mix.products || []).filter((pr) => pr.productId && getProduct(pr.productId));
  if (!library.length) {
    toast('Add those products to your library before starting this work order');
    return;
  }
  fillLogFromMix({
    area: mix.area,
    areaUnit: mix.areaUnit,
    totalSpray: mix.totalSpray,
    products: library.map((pr) => ({
      productId: pr.productId,
      rate: pr.rate,
      rateUnit: pr.unit,
      total: pr.total,
      totalUnit: pr.unit
    }))
  }, {
    fieldId: plan.fieldId && getField(plan.fieldId) ? plan.fieldId : '',
    crop: plan.crop || '',
    planId: plan.id
  });
  const skipped = (mix.products || []).length - library.length;
  toast(skipped
    ? 'Work order loaded. Some products are not in the library. Add time, weather, and lots, then Save.'
    : 'Work order loaded. Add time, weather, and lots, then Save.');
}

function planSeasonWarnings(plan) {
  if (typeof SeasonLimits === 'undefined') return [];
  const mix = plan.mix || {};
  const out = [];
  (mix.products || []).forEach((pr) => {
    const p = getProduct(pr.productId);
    if (!p || !p.seasonLimits) return;
    const incoming = {
      date: plan.targetDate || todayISO(),
      fieldId: plan.fieldId || '',
      fieldName: plan.fieldName || '',
      area: mix.area,
      areaUnit: mix.areaUnit,
      products: [{ productId: pr.productId, epaRegNo: p.epaRegNo, total: pr.total, totalUnit: pr.unit }]
    };
    out.push.apply(out, SeasonLimits.warningsFor(data, p, {
      fieldId: plan.fieldId || '',
      fieldName: plan.fieldName || '',
      seasonStart: data.settings.seasonStart,
      date: incoming.date,
      incoming
    }));
  });
  return out;
}

function saveCalcAsPlan() {
  if (!lastCalc) { toast('Calculate a mix first'); return; }
  const rows = (lastCalc.products || []).filter((pr) => pr.productId && getProduct(pr.productId));
  if (!rows.length) {
    toast('Add those products to your library before saving a work order');
    return;
  }
  const fieldId = ($('#calc-field') && $('#calc-field').value) || '';
  const field = fieldId && getField(fieldId);
  const plan = {
    id: uid(),
    fieldId: field ? field.id : '',
    fieldName: field ? field.name : '',
    crop: '',
    targetDate: '',
    target: '',
    instructions: '',
    assignedTo: '',
    mix: {
      area: lastCalc.area,
      areaUnit: lastCalc.areaUnit,
      totalSpray: lastCalc.totalSpray,
      tank: lastCalc.tank,
      gpa: lastCalc.gpa,
      gpaUnit: lastCalc.gpaUnit,
      products: rows.map((pr) => ({
        productId: pr.productId, name: pr.name, rate: pr.rate, unit: pr.unit, per: pr.per, total: pr.total
      }))
    },
    status: 'open',
    doneAppId: null,
    doneAt: null,
    createdBy: (data.settings && data.settings.deviceLabel) || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null
  };
  const warns = planSeasonWarnings(plan);
  if (warns.length && !confirm(warns.join('\n\n') + '\n\nSave this work order anyway?')) return;
  if (!Array.isArray(data.plans)) data.plans = [];
  data.plans.push(plan);
  save();
  renderCalcPlans();
  renderPlanStrip();
  toast('Work order saved');
}

function renderCalcPlans() {
  const card = $('#calc-plans-card');
  const host = $('#calc-plans-list');
  if (!card || !host || typeof WorkOrder === 'undefined') return;
  const open = WorkOrder.openPlans(data.plans);
  card.hidden = !open.length;
  host.innerHTML = open.map((p) => {
    const names = ((p.mix && p.mix.products) || []).map((x) => x.name).filter(Boolean).join(' + ');
    return `<div class="gather-item" data-plan-row="${esc(p.id)}">
      <div><strong>${esc(p.fieldName || tr('No field yet'))}</strong> · ${esc(names)}
        ${p.crop ? `<div class="card-hint">${esc(p.crop)}</div>` : ''}
        ${p.instructions ? `<div class="card-hint">${esc(p.instructions)}</div>` : ''}
        <details class="state-details">
          <summary>${esc(tr('Edit'))}</summary>
          <div class="form-row form-row-2">
            <label>${esc(tr('Crop'))}<input type="text" data-plan-crop value="${esc(p.crop || '')}"></label>
            <label>${esc(tr('Target date'))}<input type="date" data-plan-date value="${esc(p.targetDate || '')}"></label>
          </div>
          <label>${esc(tr('Instructions'))}<input type="text" data-plan-notes value="${esc(p.instructions || '')}" placeholder="${esc(tr('Wind, boom, what to watch'))}"></label>
          <button type="button" class="btn btn-secondary btn-sm" data-plan-save="${esc(p.id)}">${esc(tr('Save changes'))}</button>
        </details>
      </div>
      <div class="gather-actions">
        <button type="button" class="btn btn-primary btn-sm" data-plan-send="${esc(p.id)}">${esc(tr('Send'))}</button>
        <button type="button" class="btn btn-secondary btn-sm" data-plan-cancel="${esc(p.id)}">${esc(tr('Cancel'))}</button>
      </div>
    </div>`;
  }).join('');
  host.querySelectorAll('[data-plan-send]').forEach((b) => b.addEventListener('click', () => sendPlan(b.dataset.planSend)));
  host.querySelectorAll('[data-plan-cancel]').forEach((b) => b.addEventListener('click', () => cancelPlan(b.dataset.planCancel)));
  host.querySelectorAll('[data-plan-save]').forEach((b) => b.addEventListener('click', () => savePlanEdits(b)));
}

function savePlanEdits(btn) {
  const row = btn.closest('[data-plan-row]');
  const plan = (data.plans || []).find((p) => p.id === btn.dataset.planSave);
  if (!plan || !row) return;
  const next = {
    crop: row.querySelector('[data-plan-crop]').value.trim(),
    targetDate: row.querySelector('[data-plan-date]').value,
    instructions: row.querySelector('[data-plan-notes]').value.trim()
  };
  const warns = planSeasonWarnings(Object.assign({}, plan, next));
  if (warns.length && !confirm(warns.join('\n\n') + '\n\nSave these changes anyway?')) return;
  plan.crop = next.crop;
  plan.targetDate = next.targetDate;
  plan.instructions = next.instructions;
  plan.updatedAt = new Date().toISOString();
  save();
  renderCalcPlans();
  renderPlanStrip();
  toast('Work order updated');
}

function cancelPlan(id) {
  const plan = (data.plans || []).find((p) => p.id === id);
  if (!plan || !WorkOrder.isOpen(plan)) return;
  if (!confirm('Cancel this work order? It will leave the cab phone’s list.')) return;
  plan.status = 'cancelled';
  plan.updatedAt = new Date().toISOString();
  save();
  renderCalcPlans();
  renderPlanStrip();
}

async function sendPlan(id) {
  const plan = (data.plans || []).find((p) => p.id === id);
  if (!plan) return;
  const productIds = new Set(((plan.mix && plan.mix.products) || []).map((p) => p.productId).filter(Boolean));
  const file = WorkOrder.pack({
    appVersion: (typeof APP_VERSION !== 'undefined') ? APP_VERSION : '',
    plans: [plan],
    products: data.products.filter((p) => productIds.has(p.id)),
    fields: data.fields.filter((f) => f.id === plan.fieldId)
  });
  const blob = new Blob([JSON.stringify(file)], { type: 'application/json' });
  const name = 'work-order.json';
  try {
    if (typeof canShareBackupFile === 'function' && canShareBackupFile()) {
      const shared = new File([blob], name, { type: 'application/json' });
      await navigator.share({ files: [shared], title: 'Work order' });
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  triggerDownload(blob, name);
  toast('Work order file saved — open it on the cab phone');
}

async function ingestWorkOrder(parsed) {
  if (typeof BackupPack !== 'undefined' && BackupPack.isNewerVersion(parsed.appVersion, APP_VERSION)) {
    toast('This work order came from a newer version (' + parsed.appVersion + '). Update this device first, then open it again.');
    return;
  }
  const n = (parsed.plans || []).length;
  if (!n) { toast('That file has no work orders'); return; }
  const noun = n === 1 ? 'work order' : 'work orders';
  if (!confirm('This file has ' + n + ' ' + noun + '.\n\nOK = add them to this device.')) return;
  const incoming = migrate(Object.assign(defaultData(), {
    products: parsed.products || [],
    fields: parsed.fields || [],
    plans: parsed.plans || [],
    applications: []
  }));
  // A work-order file must not change this device's settings.
  incoming.settings = {};
  const receipt = mergeData(incoming);
  refreshAfterGather();
  renderPlanStrip();
  renderCalcPlans();
  toast('Work orders brought in');
  showGatherReceipt(receipt);
}

function initPlans() {
  if ($('#calc-save-plan')) $('#calc-save-plan').addEventListener('click', saveCalcAsPlan);
  renderPlanStrip();
}
