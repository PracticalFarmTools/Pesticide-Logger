/* Spray work orders for Pesticide Logger.
 * A work order is a plan, never a spray record. Its file has its own kind
 * so the cab phone can only merge it — the backup import's other choice
 * replaces the whole device. Loaded before app.js; also runnable under Node.
 */
(function (root) {
  'use strict';

  const KIND = 'pesticide-logger-work-order';

  function pack(opts) {
    opts = opts || {};
    return {
      kind: KIND,
      appVersion: opts.appVersion ? String(opts.appVersion) : '',
      plans: (opts.plans || []).filter((p) => p && p.id),
      products: opts.products || [],
      fields: opts.fields || []
    };
  }

  function isWorkOrder(parsed) {
    return !!(parsed && parsed.kind === KIND && Array.isArray(parsed.plans));
  }

  // Open means the cab can still turn it into a spray.
  function isOpen(plan) {
    return !!(plan && !plan.deletedAt && plan.status !== 'cancelled' && !plan.doneAppId);
  }

  function openPlans(plans) {
    return (plans || []).filter(isOpen);
  }

  const api = { KIND, pack, isWorkOrder, isOpen, openPlans };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WorkOrder = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
