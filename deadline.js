/* Shared deadline helpers for Pesticide Logger.
 * Loaded before app.js; also runnable under Node for tests.
 * Business days = Mon–Fri (no holiday calendar — farms should confirm).
 */
(function (root) {
  'use strict';

  function parseAppBase(app, fallbackTime) {
    if (!app || !app.date) return null;
    const t = app.endTime || app.startTime || fallbackTime || '23:59';
    const d = new Date(`${app.date}T${t}:00`);
    return isNaN(d.getTime()) ? null : d;
  }

  function addCalendarDays(date, days) {
    const d = new Date(date.getTime());
    d.setDate(d.getDate() + days);
    return d;
  }

  // Advance N business days from the calendar day after `date` starts counting,
  // ending at 23:59 local on the due business day. count=1 ⇒ next business day EOD
  // if starting Sat/Sun, else same-week target.
  // Convention: "within N business days" ⇒ due at end of the Nth business day
  // after the application calendar day (application day does not count).
  function addBusinessDays(fromDate, count) {
    const d = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate(), 23, 59, 0, 0);
    let left = Number(count);
    if (!Number.isFinite(left) || left <= 0) return d;
    while (left > 0) {
      d.setDate(d.getDate() + 1);
      const day = d.getDay(); // 0 Sun … 6 Sat
      if (day !== 0 && day !== 6) left -= 1;
    }
    return d;
  }

  /**
   * Resolve due timestamp from state law.
   * Supports:
   *   law.recordDeadline = { count, unit: 'hours'|'calendarDays'|'businessDays'|'sameDay' }
   * Fallback: law.recordWithinHours (0 ⇒ sameDay, else hours).
   */
  function computeRecordDueAtFromLaw(law, app) {
    if (!law || !app || !app.date) return null;
    const deadline = law.recordDeadline;
    const base = parseAppBase(app, '23:59');
    if (!base) return null;

    let unit = 'hours';
    let count = law.recordWithinHours != null ? Number(law.recordWithinHours) : 72;
    if (deadline && deadline.unit) {
      unit = deadline.unit;
      count = deadline.count != null ? Number(deadline.count) : count;
    } else if (count === 0) {
      unit = 'sameDay';
    }

    if (unit === 'sameDay') {
      return new Date(`${app.date}T23:59:00`).toISOString();
    }
    if (unit === 'businessDays') {
      return addBusinessDays(base, count).toISOString();
    }
    if (unit === 'calendarDays') {
      const due = addCalendarDays(new Date(`${app.date}T23:59:00`), count);
      return due.toISOString();
    }
    // hours
    return new Date(base.getTime() + count * 3600000).toISOString();
  }

  function computeCustomerCopyDueAtFromLaw(law, app, applicatorClass) {
    if (!law || law.customerCopyDays == null || !app || !app.date) return null;
    if (applicatorClass === 'private') return null;
    const base = new Date(`${app.date}T12:00:00`);
    if (isNaN(base.getTime())) return null;
    const unit = (law.customerCopyDeadline && law.customerCopyDeadline.unit) || 'calendarDays';
    const count = (law.customerCopyDeadline && law.customerCopyDeadline.count != null)
      ? Number(law.customerCopyDeadline.count)
      : Number(law.customerCopyDays);
    if (unit === 'businessDays') return addBusinessDays(base, count).toISOString();
    return addCalendarDays(base, count).toISOString();
  }

  const api = {
    addBusinessDays,
    addCalendarDays,
    computeRecordDueAtFromLaw,
    computeCustomerCopyDueAtFromLaw
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.DeadlineUtils = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
