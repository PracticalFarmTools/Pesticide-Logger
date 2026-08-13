/* Spanish interface translation for Pesticide Logger.
 * Dictionary keyed by exact English UI text; a DOM walker translates static
 * markup and a MutationObserver keeps dynamically rendered content covered
 * when the string matches. Dynamic composed messages (toasts, previews)
 * remain in English in this version — the toggle says so honestly.
 */
(function (root) {
  'use strict';

  const ES = {
    // Navigation
    'Dashboard': 'Panel',
    'Home': 'Inicio',
    'Spray Log': 'Registro',
    'Tank Mix': 'Mezcla',
    'Products': 'Productos',
    'Fields': 'Campos',
    'Reports': 'Informes',
    'Settings': 'Configuración',
    'More': 'Más',
    'Offline — records save locally': 'Sin conexión — los registros se guardan en el dispositivo',

    // Dashboard
    'Applications this season': 'Aplicaciones esta temporada',
    'Fields under REI now': 'Campos bajo REI ahora',
    'Crops in PHI wait': 'Cultivos en espera de PHI',
    'Incomplete state records': 'Registros estatales incompletos',
    'Products in library': 'Productos en la biblioteca',
    'Re-Entry Intervals (REI)': 'Intervalos de reingreso (REI)',
    'Pre-Harvest Intervals (PHI)': 'Intervalos precosecha (PHI)',
    'Recent applications': 'Aplicaciones recientes',
    '+ Log application': '+ Registrar aplicación',
    "Your state's rules": 'Reglas de su estado',
    'Today’s spray windows': 'Ventanas de hoy',
    'Refresh': 'Actualizar',
    'How to read this': 'Cómo leer esto',
    'Show all fields': 'Mostrar todos los campos',
    'Show morning windows': 'Mostrar ventanas de la mañana',
    'Details': 'Detalles',
    'Hide details': 'Ocultar detalles',
    'Set forecast pin': 'Fijar pin de pronóstico',
    'Print posting sheet': 'Imprimir letrero',
    'Back up your records.': 'Respalde sus registros.',
    'Download backup': 'Descargar respaldo',
    'Remind me later': 'Recordarme después',
    'Welcome to Pesticide Logger.': 'Bienvenido a Pesticide Logger.',
    'Set up my farm': 'Configurar mi granja',

    // Spray log form
    'Log an application': 'Registrar una aplicación',
    'Spray now': 'Aplicar ahora',
    'Duplicate last spray': 'Duplicar última aplicación',
    'Scan jug': 'Escanear envase',
    '📷 Scan label': '📷 Escanear etiqueta',
    'Show recommended extras': 'Mostrar extras recomendados',
    'Where': 'Dónde',
    'When': 'Cuándo',
    'Field / site': 'Campo / sitio',
    '— Select field —': '— Seleccionar campo —',
    'County of application': 'Condado de aplicación',
    'Site ID': 'ID del sitio',
    'Crop / commodity / site treated': 'Cultivo / producto / sitio tratado',
    'Target pest': 'Plaga objetivo',
    'Purpose of application': 'Propósito de la aplicación',
    'Location description override': 'Descripción de ubicación (ajuste)',
    'Permit / operator ID': 'Permiso / ID de operador',
    'Application date': 'Fecha de aplicación',
    'Start time': 'Hora de inicio',
    'End time': 'Hora de término',
    'Product': 'Producto',
    '— Select product —': '— Seleccionar producto —',
    'Lot / batch #': 'N.º de lote',
    'Rate': 'Dosis',
    'Total applied': 'Total aplicado',
    'REI hours (label / override)': 'Horas REI (etiqueta / ajuste)',
    'PHI days (label / override)': 'Días PHI (etiqueta / ajuste)',
    'OMRI / organic input': 'Insumo OMRI / orgánico',
    'Remove product': 'Quitar producto',
    '+ Add product to mix': '+ Agregar producto a la mezcla',
    'Carrier / finished spray': 'Portador / mezcla final',
    'Dilution rate': 'Tasa de dilución',
    'Concentration': 'Concentración',
    'Mix / load location': 'Lugar de mezcla / carga',
    'Conditions': 'Condiciones',
    'Wind speed (mph)': 'Velocidad del viento (mph)',
    'Wind direction': 'Dirección del viento',
    'Temperature (°F)': 'Temperatura (°F)',
    'Sky / humidity': 'Cielo / humedad',
    'Fetch current weather': 'Obtener clima actual',
    'Boom / release height': 'Altura del aguilón',
    'Ground speed': 'Velocidad de avance',
    'Buffer distance': 'Distancia de amortiguamiento',
    'Temperature inversion suspected': 'Se sospecha inversión térmica',
    'Sensitive sites / neighbors noted': 'Sitios sensibles / vecinos anotados',
    'Equipment': 'Equipo',
    'Application type': 'Tipo de aplicación',
    'Ground': 'Terrestre',
    'Aerial': 'Aérea',
    'Chemigation': 'Quimigación',
    'Other': 'Otro',
    'Method / equipment': 'Método / equipo',
    'Nozzle type': 'Tipo de boquilla',
    'Sprayer pressure': 'Presión del aspersor',
    'Equipment ID': 'ID del equipo',
    'Aircraft ID': 'ID de la aeronave',
    'Who': 'Quién',
    'Applicator name': 'Nombre del aplicador',
    'Certification / license #': 'N.º de certificación / licencia',
    'Supervising applicator': 'Aplicador supervisor',
    'Noncertified / trainee applicator participated': 'Participó un aplicador no certificado / aprendiz',
    'Noncertified / trainee name': 'Nombre del no certificado / aprendiz',
    'Owner / operator name': 'Propietario / operador',
    'Customer / for whom applied': 'Cliente / para quién se aplicó',
    'Customer address': 'Dirección del cliente',
    'Customer phone': 'Teléfono del cliente',
    'Customer copy of this record provided': 'Se entregó copia del registro al cliente',
    'Customer copy date': 'Fecha de la copia al cliente',
    'Business name & address': 'Nombre y dirección del negocio',
    'Company license #': 'Licencia de la empresa',
    'Pesticide supplier': 'Proveedor de pesticidas',
    'Notes & disposal': 'Notas y eliminación',
    'Disposal of unused pesticide': 'Eliminación del pesticida no usado',
    'Notes': 'Notas',
    'Attach photo (label, lot, conditions…)': 'Adjuntar foto (etiqueta, lote, condiciones…)',
    'Save complete record': 'Guardar registro completo',
    'Save incomplete draft': 'Guardar borrador incompleto',
    'Cancel edit': 'Cancelar edición',
    'Update complete record': 'Actualizar registro completo',
    'Application history': 'Historial de aplicaciones',
    'Show deleted': 'Mostrar eliminados',
    'Edit': 'Editar',
    'Delete': 'Eliminar',
    'Restore': 'Restaurar',
    'History': 'Historial',
    'Date': 'Fecha',
    'Field / crop': 'Campo / cultivo',
    'Area': 'Área',
    'Applicator': 'Aplicador',

    // Products
    'Add a product': 'Agregar un producto',
    'Product library': 'Biblioteca de productos',
    'Product name': 'Nombre del producto',
    'EPA registration #': 'N.º de registro EPA',
    'Active ingredient': 'Ingrediente activo',
    'Type': 'Tipo',
    'Signal word': 'Palabra de advertencia',
    'Restricted-use pesticide (RUP)': 'Pesticida de uso restringido (RUP)',
    'REI (hours)': 'REI (horas)',
    'PHI (days)': 'PHI (días)',
    'Label rate': 'Dosis de etiqueta',
    'Manufacturer / registrant': 'Fabricante / registrante',
    'State registration / SLN #': 'Registro estatal / SLN',
    'OMRI Listed / organic-approved input': 'Insumo OMRI / aprobado para orgánico',
    'Default lot / batch # pattern': 'Patrón de lote predeterminado',
    'Jug barcode (for cab scanning)': 'Código de barras del envase',
    'Scan': 'Escanear',
    'Attach label photo': 'Adjuntar foto de etiqueta',
    'Save product': 'Guardar producto',
    'Update product': 'Actualizar producto',
    'Verify my library': 'Verificar mi biblioteca',

    // Fields
    'Add a field / site': 'Agregar un campo / sitio',
    'Field name': 'Nombre del campo',
    'Size': 'Tamaño',
    'Usual crop': 'Cultivo habitual',
    'Location description': 'Descripción de ubicación',
    'Save field': 'Guardar campo',
    'Fields & sites': 'Campos y sitios',
    'My location': 'Mi ubicación',
    'Use this shape': 'Usar esta forma',
    'Undo point': 'Deshacer punto',
    '✕ Clear': '✕ Borrar',

    // Reports
    'Reports & export': 'Informes y exportación',
    'From': 'Desde',
    'To': 'Hasta',
    'Field': 'Campo',
    'All fields': 'Todos los campos',
    'All products': 'Todos los productos',
    'Include soft-deleted records (audit / retention)': 'Incluir registros eliminados (auditoría / retención)',
    'Print / PDF inspection report': 'Imprimir informe de inspección',
    'Download CSV': 'Descargar CSV',
    'Download state compliance pack': 'Descargar paquete estatal',
    'Print certifier / buyer packet': 'Imprimir paquete para certificador',
    'Backup & restore': 'Respaldo y restauración',
    'Download full backup (.json)': 'Descargar respaldo completo (.json)',
    'Share to another device': 'Compartir a otro dispositivo',
    'Restore / merge from backup': 'Restaurar / combinar desde respaldo',
    'Connect automatic backup file': 'Conectar archivo de respaldo automático',
    'Re-enable automatic backup': 'Reactivar respaldo automático',
    'Disconnect': 'Desconectar',
    'Import from a spreadsheet': 'Importar desde una hoja de cálculo',
    'Choose CSV file…': 'Elegir archivo CSV…',

    // Calculator
    'Tank mix calculator': 'Calculadora de mezcla',
    'Calculate mix': 'Calcular mezcla',
    'Print mix worksheet': 'Imprimir hoja de mezcla',
    'Area to treat': 'Área a tratar',
    'Tank size (gal)': 'Tamaño del tanque (gal)',
    'Spray volume': 'Volumen de aspersión',

    // Settings
    'Farm & applicator': 'Granja y aplicador',
    'Farm name': 'Nombre de la granja',
    'State': 'Estado',
    '— Select state —': '— Seleccionar estado —',
    'Default county': 'Condado predeterminado',
    'Applicator class': 'Clase de aplicador',
    'Private / grower': 'Privado / agricultor',
    'Commercial / for-hire': 'Comercial / por contrato',
    'Both (strictest fields)': 'Ambos (campos más estrictos)',
    'Default applicator name': 'Nombre de aplicador predeterminado',
    'Certification expiry': 'Vencimiento de la certificación',
    'Default permit / operator ID': 'Permiso / ID de operador predeterminado',
    'Save settings': 'Guardar configuración',
    'Interface language': 'Idioma de la interfaz',
    'State recordkeeping requirements': 'Requisitos estatales de registros',
    'Reminders': 'Recordatorios',
    'Notify me when a field clears REI or a crop reaches its earliest harvest date':
      'Avisarme cuando un campo termine el REI o un cultivo llegue a su primera fecha de cosecha',
    'License': 'Licencia',
    'License key': 'Clave de licencia',
    'Activate': 'Activar',
    'Buy a license': 'Comprar una licencia',
    'Your spray logs stay with you': 'Sus registros de aspersión se quedan con usted',
    'Show prior years': 'Ver años anteriores',
    'This season only': 'Solo esta temporada',
    'Download backup': 'Descargar respaldo',
    'Search fields…': 'Buscar campos…',
    'Search products…': 'Buscar productos…',
    'Type to find a field…': 'Escriba para hallar un campo…',
    'Type to find a product…': 'Escriba para hallar un producto…',
    'Fit all fields': 'Ajustar todos los campos',
    'Group / place': 'Grupo / lugar',
    'Fields & sites': 'Campos y sitios',
    'Product library': 'Biblioteca de productos',
    'No records match your search.': 'Ningún registro coincide con la búsqueda.',
    'Data': 'Datos',
    'Erase all data on this device': 'Borrar todos los datos de este dispositivo',
    'About': 'Acerca de',
    'Terms of use, license & privacy': 'Términos de uso, licencia y privacidad',

    // Dialogs
    'Close': 'Cerrar',
    'Cancel': 'Cancelar',
    'Remove photo': 'Quitar foto',
    'Scan a barcode': 'Escanear un código de barras',
    'Match your spreadsheet columns': 'Relacione las columnas de su hoja',
    'Import records': 'Importar registros',
    'Welcome — set up your farm in 30 seconds': 'Bienvenido — configure su granja en 30 segundos',
    'Your state': 'Su estado',
    'Start logging': 'Comenzar a registrar',
    'Skip for now': 'Omitir por ahora'
  };

  function makeTranslator(dict) {
    const ATTRS = ['placeholder', 'aria-label', 'title'];
    function translateTextNode(node) {
      const raw = node.nodeValue;
      const key = raw.trim();
      if (!key) return;
      const hit = dict[key];
      if (hit) node.nodeValue = raw.replace(key, hit);
    }
    function walk(el) {
      if (el.nodeType === Node.TEXT_NODE) { translateTextNode(el); return; }
      if (el.nodeType !== Node.ELEMENT_NODE) return;
      const tag = el.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE') return;
      ATTRS.forEach(a => {
        const v = el.getAttribute && el.getAttribute(a);
        if (v && dict[v.trim()]) el.setAttribute(a, dict[v.trim()]);
      });
      for (let child = el.firstChild; child; child = child.nextSibling) walk(child);
    }
    return { walk };
  }

  function applyLanguage(lang) {
    if (lang !== 'es') return null;
    const t = makeTranslator(ES);
    document.documentElement.lang = 'es';
    t.walk(document.body);
    const observer = new MutationObserver(muts => {
      muts.forEach(m => m.addedNodes.forEach(n => t.walk(n)));
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return observer;
  }

  const api = { ES, applyLanguage, makeTranslator };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.I18n = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
