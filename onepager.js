/* Print helper for inspector.html and extension.html. No farm data. */
(function () {
  'use strict';
  function bind() {
    if (typeof I18n !== 'undefined' && I18n.bindPublicLanguage) I18n.bindPublicLanguage(document);
    const btn = document.getElementById('onepager-print');
    if (btn) btn.addEventListener('click', function () { window.print(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
