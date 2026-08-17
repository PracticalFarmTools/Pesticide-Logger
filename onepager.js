/* Print helper for inspector.html and extension.html. No farm data. */
(function () {
  'use strict';
  function bind() {
    const btn = document.getElementById('onepager-print');
    if (btn) btn.addEventListener('click', function () { window.print(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
