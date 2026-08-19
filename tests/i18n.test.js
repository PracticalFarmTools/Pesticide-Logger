#!/usr/bin/env node
/* French + Brazilian Portuguese dictionaries: key parity, lookups, wiring. */
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const i18n = require(path.join(root, 'i18n.js'));

let failed = 0;
function check(name, fn) {
  try { fn(); console.log('ok  -', name); }
  catch (e) { failed++; console.error('FAIL -', name); console.error('     ', e.message); }
}

function keysOf(dict) {
  return Object.keys(dict).sort();
}

check('es, fr, and pt-BR expose the same English keys', () => {
  const es = keysOf(i18n.ES);
  const fr = keysOf(i18n.FR);
  const pt = keysOf(i18n.PT_BR);
  assert.deepStrictEqual(fr, es, 'FR keys differ from ES');
  assert.deepStrictEqual(pt, es, 'pt-BR keys differ from ES');
  assert.ok(es.length >= 240, 'dictionary size ' + es.length);
});

check('no empty translations in any dictionary', () => {
  ['ES', 'FR', 'PT_BR'].forEach((name) => {
    Object.entries(i18n[name]).forEach(([k, v]) => {
      assert.ok(typeof v === 'string' && v.trim(), name + ' empty for ' + JSON.stringify(k));
    });
  });
});

check('t() looks up es, fr, pt-BR and leaves English alone', () => {
  assert.strictEqual(i18n.t('es', 'Save farm'), 'Guardar granja');
  assert.strictEqual(i18n.t('fr', 'Save farm'), 'Enregistrer l’exploitation');
  assert.strictEqual(i18n.t('pt-BR', 'Save farm'), 'Salvar fazenda');
  assert.strictEqual(i18n.t('', 'Save farm'), 'Save farm');
  assert.strictEqual(i18n.t('en', 'Save farm'), 'Save farm');
  assert.strictEqual(i18n.t('es', 'Settings saved'), 'Configuración guardada');
});

check('whitespace-normalized keys still hit (wrapped HTML hints)', () => {
  const wrapped = '  Save farm \n ';
  assert.strictEqual(i18n.t('fr', wrapped), 'Enregistrer l’exploitation');
  assert.strictEqual(i18n.t('pt-BR', wrapped), 'Salvar fazenda');
});

check('farm terms: French vous + parcelle; Brazilian você + talhão/calda', () => {
  assert.strictEqual(i18n.FR['Fields'], 'Parcelles');
  assert.strictEqual(i18n.PT_BR['Fields'], 'Talhões');
  assert.strictEqual(i18n.FR['Tank Mix'], 'Mélange');
  assert.strictEqual(i18n.PT_BR['Tank Mix'], 'Calda');
  assert.strictEqual(i18n.FR['Inspector packet'], 'Dossier inspecteur');
  assert.strictEqual(i18n.PT_BR['Inspector packet'], 'Pacote do fiscal');
  assert.strictEqual(i18n.ES['Open citation'], 'Abrir cita');
  assert.strictEqual(i18n.FR['Applicator'], 'Applicateur');
  assert.strictEqual(i18n.PT_BR['Applicator'], 'Aplicador');
  const frBlob = Object.values(i18n.FR).join('\n');
  const ptBlob = Object.values(i18n.PT_BR).join('\n');
  assert.ok(/votre |vous |Vos /.test(frBlob), 'French uses vous/votre');
  assert.ok(!/\bficheiro\b/.test(ptBlob), 'pt-BR must not use European ficheiro');
  assert.ok(!/\btelemóvel\b/.test(ptBlob), 'pt-BR must not use European telemóvel');
  assert.ok(!/\bregisto\b/.test(ptBlob), 'pt-BR must not use European registo');
  assert.ok(/você|seu |sua |seus |suas /.test(ptBlob), 'pt-BR uses você/seu');
  assert.ok(/\btalhão\b|\btalhões\b/.test(ptBlob), 'pt-BR uses talhão');
  assert.ok(/\bcalda\b/.test(ptBlob), 'pt-BR uses calda');
});

check('US units and EPA signal words stay English in the dictionaries', () => {
  assert.strictEqual(i18n.FR['Wind speed (mph)'], 'Vitesse du vent (mph)');
  assert.strictEqual(i18n.PT_BR['Wind speed (mph)'], 'Velocidade do vento (mph)');
  assert.strictEqual(i18n.FR['Temperature (°F)'], 'Température (°F)');
  assert.strictEqual(i18n.PT_BR['acre'], 'acre');
  assert.ok(!i18n.ES['CAUTION'] && !i18n.FR['CAUTION'] && !i18n.PT_BR['CAUTION']);
  assert.ok(!i18n.ES['WARNING'] && !i18n.FR['DANGER']);
  assert.strictEqual(i18n.t('fr', 'Metric reference — not the legal record'), 'Référence métrique — pas le registre officiel');
  assert.strictEqual(i18n.t('pt-BR', 'Metric reference — not the legal record'), 'Referência métrica — não é o registro legal');
});

check('curly-apostrophe toasts used by app.js are translated', () => {
  const jug = 'New barcode — add this jug\u2019s product now';
  const couldnt = 'Couldn\u2019t read an EPA registration number — search manually below';
  assert.notStrictEqual(i18n.t('fr', jug), jug);
  assert.notStrictEqual(i18n.t('pt-BR', jug), jug);
  assert.notStrictEqual(i18n.t('es', jug), jug);
  assert.notStrictEqual(i18n.t('fr', couldnt), couldnt);
  assert.notStrictEqual(i18n.t('pt-BR', couldnt), couldnt);
});

check('log Next coach is translated', () => {
  assert.strictEqual(i18n.t('es', 'Next: pick the field'), 'Siguiente: elija el campo');
  assert.strictEqual(i18n.t('fr', 'Next: pick a product, or Scan label'), 'Suivant : choisissez un produit, ou scannez l’étiquette');
  assert.notStrictEqual(
    i18n.t('pt-BR', 'Ready to save.'),
    'Ready to save.'
  );
});

check('mix Scan label chrome is translated', () => {
  assert.strictEqual(i18n.t('es', 'Scan label'), 'Escanear etiqueta');
  assert.strictEqual(i18n.t('fr', 'Scan barcode'), 'Scanner le code-barres');
  assert.notStrictEqual(
    i18n.t('pt-BR', 'Photograph the EPA Reg. No. on the panel, or pick from your library.'),
    'Photograph the EPA Reg. No. on the panel, or pick from your library.'
  );
  assert.strictEqual(i18n.t('es', 'Find a product'), 'Hallar un producto');
  assert.strictEqual(i18n.t('es', 'Matches:'), 'Coincidencias:');
  assert.notStrictEqual(
    i18n.t('pt-BR', 'No library match. Scan label or add the product.'),
    'No library match. Scan label or add the product.'
  );
  assert.notStrictEqual(
    i18n.t('fr', 'Type a name or EPA # from your library. Scan label is optional.'),
    'Type a name or EPA # from your library. Scan label is optional.'
  );
  assert.notStrictEqual(
    i18n.t('es', 'Could not read that label — photograph the EPA Reg. No. line in better light, or type it'),
    'Could not read that label — photograph the EPA Reg. No. line in better light, or type it'
  );
});

check('cab A+ restage, stamp weather, and send-now chrome are translated', () => {
  assert.strictEqual(i18n.t('es', 'Stamp weather'), 'Sellar clima');
  assert.strictEqual(i18n.t('fr', 'Save this spray'), 'Enregistrer cette pulvérisation');
  assert.strictEqual(i18n.t('pt-BR', 'This is the cab phone'), 'Este é o celular da cabine');
  assert.notStrictEqual(i18n.t('es', 'Same mix, time is now. Confirm field and Save.'), 'Same mix, time is now. Confirm field and Save.');
  assert.notStrictEqual(
    i18n.t('fr', 'Saved. Same mix — pick the next field and Save.'),
    'Saved. Same mix — pick the next field and Save.'
  );
  assert.notStrictEqual(
    i18n.t('pt-BR', 'There is no cloud copy. One tap sends a file to the shop, or Chrome can connect a folder you already share. We never store it. Tape the restore card in the shop.'),
    'There is no cloud copy. One tap sends a file to the shop, or Chrome can connect a folder you already share. We never store it. Tape the restore card in the shop.'
  );
});

check('open-host license status is translated', () => {
  const msg = 'This host has no checkout. Logging stays open. Spray logs stay on this device.';
  assert.ok(i18n.ES[msg] && i18n.FR[msg] && i18n.PT_BR[msg]);
  assert.notStrictEqual(i18n.t('es', 'Open the logger — no card'), 'Open the logger — no card');
});

check('checkout note names the mailbox until Buy is live', () => {
  const note = 'Paste a license key from your purchase email. Until checkout is live, email practicalfarmtools@gmail.com. Spray logs stay on this device either way.';
  assert.ok(i18n.ES[note]);
  assert.ok(i18n.FR[note]);
  assert.ok(i18n.PT_BR[note]);
  assert.ok(i18n.ES[note].includes('practicalfarmtools@gmail.com'));
});

check('how-to and catch-up chrome are translated', () => {
  assert.strictEqual(i18n.t('es', 'How-to'), 'Cómo');
  assert.strictEqual(i18n.t('fr', 'Send a file to the shop'), 'Envoyer un fichier à l’atelier');
  assert.notStrictEqual(i18n.t('pt-BR', 'Caught up from the connected backup file.'), 'Caught up from the connected backup file.');
});

check('keep-book ritual and CSV honesty are translated', () => {
  assert.strictEqual(i18n.t('es', 'Keep this book'), 'Conserve este libro');
  assert.notStrictEqual(i18n.t('fr', 'I’ll log first'), 'I’ll log first');
  assert.notStrictEqual(i18n.t('pt-BR', 'Customer / business'), 'Customer / business');
  assert.notStrictEqual(
    i18n.t('es', 'Imported rows are drafts. We never invent REI, PHI, or rates, and we never mark a row complete. Empty boxes after import are the point — your state checker lists what each spray still needs.'),
    'Imported rows are drafts. We never invent REI, PHI, or rates, and we never mark a row complete. Empty boxes after import are the point — your state checker lists what each spray still needs.'
  );
});

check('first-run and reminder titles are translated', () => {
  assert.strictEqual(i18n.t('fr', 'Get set up to log'), 'Préparez-vous à enregistrer');
  assert.strictEqual(i18n.t('pt-BR', 'Get set up to log'), 'Prepare-se para registrar');
  assert.strictEqual(i18n.t('es', "Welcome. Let's log."), 'Bienvenido. Vamos a registrar.');
  assert.notStrictEqual(i18n.t('fr', 'REI ends within an hour'), 'REI ends within an hour');
  assert.notStrictEqual(i18n.t('pt-BR', 'Earliest harvest date reached'), 'Earliest harvest date reached');
});

check('French is not a copy of Spanish (except identical cognates)', () => {
  let same = 0;
  let different = 0;
  Object.keys(i18n.ES).forEach((k) => {
    if (i18n.ES[k] === i18n.FR[k]) same++;
    else different++;
  });
  assert.ok(different > same * 8, 'too many FR strings identical to ES (' + same + ' same, ' + different + ' different)');
});

check('app.js applies any dictionary language, not only Spanish', () => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const i18nSrc = fs.readFileSync(path.join(root, 'i18n.js'), 'utf8');
  assert.ok(app.includes('function applyUiLanguage'), 'language boot helper');
  assert.ok(app.includes("I18n.applyLanguage(lang)"), 'applyLanguage uses saved lang');
  assert.ok(!/language === 'es'/.test(app), 'boot is not hardcoded to es');
  assert.ok(i18nSrc.includes('DICTS[lang]'), 'applyLanguage is dictionary-driven');
  assert.ok(!i18nSrc.includes("if (lang !== 'es')"), 'applyLanguage is not es-only');
  assert.ok(i18nSrc.includes("closest('.posting-sheet')"), 'WPS posting skipped');
  assert.ok(html.includes('value="fr">Français'), 'French option');
  assert.ok(html.includes('value="pt-BR">Português (Brasil)'), 'Brazilian Portuguese option');
  assert.ok(!html.includes('id="header-language"'), 'language picker is not in the header');
  assert.ok(html.includes('id="set-language"') && html.includes('id="first-run-language"'),
    'language stays on first-run and Settings');
  assert.ok(app.includes('NO ENTRE'), 'posting stays bilingual EN/ES');
  assert.ok(typeof i18n.bindPublicLanguage === 'function');
  assert.ok(typeof i18n.readStoredLang === 'function');
  assert.strictEqual(i18n.readStoredLang(), '');
  const start = fs.readFileSync(path.join(root, 'start.html'), 'utf8');
  assert.ok(start.includes('id="public-lang"'));
  const how = fs.readFileSync(path.join(root, 'how.html'), 'utf8');
  assert.ok(how.includes('id="public-lang"'));
});

check('class picker strings are translated and keep {State}', () => {
  assert.strictEqual(i18n.t('es', 'This log is for'), 'Este registro es para');
  assert.strictEqual(i18n.t('fr', 'Commercial applicator work'), 'Travail d’applicateur commercial');
  assert.notStrictEqual(
    i18n.t('pt-BR', 'This book covers both'),
    'This book covers both'
  );
  const quiet = 'In {State}, a grower log stays quiet on for-hire boxes. Confirm with the agency.';
  assert.ok(i18n.t('es', quiet).includes('{State}'));
  assert.ok(i18n.t('fr', quiet).includes('{State}'));
  assert.ok(i18n.t('pt-BR', quiet).includes('{State}'));
});

if (failed) {
  console.error('\n' + failed + ' check(s) failed');
  process.exit(1);
}
console.log('\nAll i18n checks passed.');
