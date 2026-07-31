/**
 * Practical Farm Tools — Compliance Export Engine
 * One-click PDF & CSV export for spray audit records.
 * Uses jsPDF for PDF generation — no server dependency.
 * © 2026 Practical Farm Tools. All rights reserved.
 */

// ═══════════════════════════════════════
// PDF EXPORT (jsPDF)
// ═══════════════════════════════════════

/**
 * generateSprayPDF()
 * Generates a professional compliance PDF with:
 *   - State letterhead + farm identity header
 *   - Spray log table from localStorage history
 *   - Signature/attestation line
 *   - QR code link to live Google Sheet
 */
function generateSprayPDF() {
    // Lazy-load jsPDF from CDN if not already loaded
    if (typeof window.jspdf === 'undefined' && typeof jsPDF === 'undefined') {
        return _loadJsPDF().then(() => _buildPDF());
    }
    return _buildPDF();
}

function _loadJsPDF() {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        script.onload = () => {
            // Also load autoTable plugin for table rendering
            const tableScript = document.createElement('script');
            tableScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
            tableScript.onload = resolve;
            tableScript.onerror = reject;
            document.head.appendChild(tableScript);
        };
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

function _buildPDF() {
    const { jsPDF } = window.jspdf || { jsPDF: window.jsPDF };
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });

    const profile = _getProfile();
    const logs = _getSprayLogs();
    const state = profile.state || 'DEFAULT';
    const stateName = typeof STATE_NAMES !== 'undefined' ? (STATE_NAMES[state] || state) : state;

    // ── Header Banner ──
    doc.setFillColor(27, 94, 32);
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), 60, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Pesticide Application Record', 40, 28);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${profile.farm || 'Farm'} | ${profile.name || 'Applicator'} | License: ${profile.license || 'N/A'} | State: ${stateName}`, 40, 48);

    // ── Date & Report Info ──
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    const today = new Date();
    doc.text(`Generated: ${today.toLocaleDateString('en-US')} at ${today.toLocaleTimeString('en-US')}`, doc.internal.pageSize.getWidth() - 240, 75);
    doc.text(`Total Records: ${logs.length}`, doc.internal.pageSize.getWidth() - 240, 87);

    // ── Spray Log Table (Full Compliance Columns) ──
    if (logs.length > 0) {
        const headers = [
            'Date/Time', 'Applicator', 'License', 'State', 'Field', 'Crop',
            'Product(s)', 'EPA #', 'Active Ingredient', 'Rate/Acre', 'Total Applied',
            'REI', 'PHI', 'Wind Dir', 'Acreage', 'GPS', 'Weather', 'Buffer'
        ];
        const rows = logs.map(log => [
            _formatDate(log.Timestamp || log.timestamp),
            log.Applicator_Name || 'N/A',
            log.Applicator_License || 'N/A',
            log.State || 'N/A',
            log.Field_Name || log.fieldName || 'N/A',
            log.Target_Crop || log.Crop_Category || 'N/A',
            log.All_Product_Names || log.product || log.Product_Name || 'N/A',
            log.All_EPA_Nos || log.productEpa || log.EPA_No || 'N/A',
            log.Active_Ingredients || log.Active_Ingredient || 'N/A',
            log.Rate_Per_Acre || log.Mix_Rate || log.mixRate || 'N/A',
            log.Total_Product_Applied || 'N/A',
            log.REI || log.REI_Hours || 'N/A',
            log.PHI || log.PHI_Days || 'N/A',
            log.Wind_Direction || 'N/A',
            log.Acreage || 'N/A',
            _truncateGPS(log.GPS_Coordinates),
            _formatWeather(log),
            log.Buffer_Ft ? `${log.Buffer_Ft}ft` : 'N/A'
        ]);

        doc.autoTable({
            head: [headers],
            body: rows,
            startY: 100,
            theme: 'grid',
            styles: {
                fontSize: 6,
                cellPadding: 3,
                overflow: 'linebreak',
                font: 'helvetica',
                valign: 'middle',
                halign: 'center'
            },
            headStyles: {
                fillColor: [27, 94, 32],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 6.5
            },
            alternateRowStyles: {
                fillColor: [240, 253, 244]
            },
            columnStyles: {
                0: { cellWidth: 48 },
                1: { cellWidth: 42 },
                2: { cellWidth: 38 },
                3: { cellWidth: 22 },
                4: { cellWidth: 42 },
                5: { cellWidth: 35 },
                6: { cellWidth: 65, halign: 'left' },
                7: { cellWidth: 40 },
                8: { cellWidth: 50, halign: 'left', fontSize: 5.5 },
                9: { cellWidth: 42 },
                10: { cellWidth: 38 },
                13: { cellWidth: 28 },
                15: { cellWidth: 48, fontSize: 5.5 }
            },
            margin: { left: 15, right: 15 }
        });
    } else {
        doc.setTextColor(150, 150, 150);
        doc.setFontSize(12);
        doc.text('No spray records found in local storage.', 40, 120);
    }

    // ── Signature / Attestation Block ──
    const pageHeight = doc.internal.pageSize.getHeight();
    const sigY = pageHeight - 80;

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(40, sigY, 280, sigY);
    doc.line(360, sigY, 540, sigY);

    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.text('Applicator Signature', 40, sigY + 14);
    doc.text('Date', 360, sigY + 14);

    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.text('I certify that the above pesticide application records are accurate and complete to the best of my knowledge.', 40, sigY + 30);

    // ── Footer ──
    doc.setFontSize(6);
    doc.setTextColor(180, 180, 180);
    doc.text(`by Practical Farm Tools | ${stateName} Compliance Record | ${today.getFullYear()}`, 40, pageHeight - 20);

    // ── Save PDF ──
    const filename = `PFT_Spray_Record_${state}_${today.toISOString().split('T')[0]}.pdf`;
    doc.save(filename);

    if (typeof showToast === 'function') {
        showToast(`📄 PDF exported: ${filename}`, 'success', 3000);
    }
    if ('vibrate' in navigator) navigator.vibrate([40, 60, 40]);
}

// ═══════════════════════════════════════
// CSV EXPORT
// ═══════════════════════════════════════

/**
 * generateSprayCSV()
 * Exports spray history as a downloadable CSV file.
 * Compatible with Excel, Google Sheets, and farm management software.
 */
function generateSprayCSV() {
    const logs = _getSprayLogs();
    if (logs.length === 0) {
        if (typeof showToast === 'function') showToast('No spray records to export', 'warn');
        return;
    }

    // Collect all unique keys across all logs
    const allKeys = new Set();
    logs.forEach(log => Object.keys(log).forEach(k => allKeys.add(k)));

    // Priority order for key columns
    const priority = ['Timestamp', 'timestamp', 'Applicator_Name', 'Applicator_License',
        'Farm_Name', 'State', 'Field_Name', 'fieldName', 'Target_Crop', 'Crop_Category',
        'All_Product_Names', 'product', 'All_EPA_Nos', 'productEpa',
        'Active_Ingredients', 'Rate_Per_Acre', 'Rate_Unit', 'Total_Product_Applied', 'Rate_Compliance',
        'Mix_Rate', 'mixRate', 'REI', 'PHI', 'MOA_Groups',
        'Acreage', 'Wind_Direction', 'Start_Time', 'Stop_Time',
        'GPS_Coordinates', 'Temp_Humidity', 'Wind_API', 'Buffer_Ft'];
    const orderedKeys = [...priority.filter(k => allKeys.has(k)), ...[...allKeys].filter(k => !priority.includes(k))];

    // Build CSV
    const escape = (val) => {
        const str = String(val ?? '');
        return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"` : str;
    };

    const csv = [
        orderedKeys.map(escape).join(','),
        ...logs.map(log => orderedKeys.map(k => escape(log[k] ?? '')).join(','))
    ].join('\n');

    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const profile = _getProfile();
    const today = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `PFT_Spray_Log_${profile.state || 'ALL'}_${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (typeof showToast === 'function') showToast('📊 CSV exported', 'success', 2500);
    if ('vibrate' in navigator) navigator.vibrate([30]);
}

// ═══════════════════════════════════════
// EXPORT MODAL UI
// ═══════════════════════════════════════

/**
 * openExportModal()
 * Opens the export options modal with PDF, CSV, and Share Link choices.
 */
function openExportModal() {
    // Always rebuild the modal so record count and profile are fresh
    let modal = document.getElementById('export-modal');
    if (modal) modal.remove();
    modal = _createExportModal();
    document.body.appendChild(modal);
    // Force reflow before adding .show for CSS transition
    void modal.offsetWidth;
    modal.classList.add('show');
    if (typeof refreshIcons === 'function') refreshIcons();
}

function closeExportModal() {
    const modal = document.getElementById('export-modal');
    if (modal) modal.classList.remove('show');
}

function _createExportModal() {
    const backdrop = document.createElement('div');
    backdrop.id = 'export-modal';
    backdrop.className = 'export-modal-backdrop';
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeExportModal(); });

    const profile = _getProfile();
    const logs = _getSprayLogs();

    // Build history timeline cards
    const historyCards = logs.length > 0
        ? logs.slice().reverse().slice(0, 20).map((log, i) => {
            const date = log.Timestamp || log.timestamp;
            const formatted = date ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Unknown';
            const field = log.Field_Name || log.fieldName || 'Unnamed';
            const product = log.All_Product_Names || log.product || 'Unknown';
            const rate = log.Rate_Per_Acre || log.Mix_Rate || log.mixRate || '--';
            const crop = log.Target_Crop || log.Crop_Category || '--';
            const method = log.Method || 'Ground';
            const epa = log.All_EPA_Nos || log.productEpa || '--';
            const acreage = log.Acreage || '--';
            const methodIcon = method.includes('Aerial') ? '✈️' : method.includes('Chemi') ? '💧' : method.includes('Backpack') ? '🎒' : method.includes('Inject') ? '💉' : '🚜';

            return `
                <div class="history-card" onclick="this.classList.toggle('expanded')">
                    <div class="history-card-header">
                        <span class="history-date">${formatted}</span>
                        <span class="history-method">${methodIcon} ${method}</span>
                    </div>
                    <div class="history-card-body">
                        <div class="history-field">${field}</div>
                        <div class="history-product">${product}</div>
                        <div class="history-meta">
                            <span>EPA: ${epa}</span>
                            <span>Rate: ${rate}</span>
                            <span>${acreage} ac</span>
                            <span>${crop}</span>
                        </div>
                    </div>
                    <div class="history-expanded-details">
                        <div class="history-detail-row"><span>REI:</span> <span>${log.REI || '--'}</span></div>
                        <div class="history-detail-row"><span>PHI:</span> <span>${log.PHI || '--'}</span></div>
                        <div class="history-detail-row"><span>Active Ingredients:</span> <span>${log.Active_Ingredients || '--'}</span></div>
                        <div class="history-detail-row"><span>Wind:</span> <span>${log.Wind_Direction || '--'}</span></div>
                        <div class="history-detail-row"><span>Buffer:</span> <span>${log.Buffer_Ft ? log.Buffer_Ft + 'ft' : '--'}</span></div>
                        <div class="history-detail-row"><span>GPS:</span> <span>${log.GPS_Coordinates || '--'}</span></div>
                    </div>
                </div>`;
        }).join('')
        : `<div class="history-empty">
                <i data-lucide="clipboard-list" width="32"></i>
                <p>No spray records yet</p>
                <p class="history-empty-sub">Complete your first spray log and it will appear here</p>
           </div>`;

    backdrop.innerHTML = `
        <div class="export-modal-card export-modal-card-full">
            <div class="export-modal-header">
                <div class="export-modal-title">
                    <i data-lucide="clipboard-list" width="20"></i>
                    Spray Records
                </div>
                <button class="export-modal-close" onclick="closeExportModal()">✕</button>
            </div>
            <div class="export-modal-summary">
                <span>${logs.length} record${logs.length !== 1 ? 's' : ''}</span>
                <span>·</span>
                <span>${profile.farm || 'Your Farm'}</span>
                <span>·</span>
                <span>${profile.state || 'All States'}</span>
            </div>

            <div class="history-timeline">
                ${historyCards}
            </div>

            <div class="export-section-divider">
                <span>Export Options</span>
            </div>
            <div class="export-modal-options">
                <button class="export-option-btn" onclick="generateSprayPDF(); closeExportModal();">
                    <i data-lucide="file-text" width="28"></i>
                    <div class="export-option-label">PDF Report</div>
                    <div class="export-option-desc">Printable compliance record with signature line</div>
                </button>
                <button class="export-option-btn" onclick="generateSprayCSV(); closeExportModal();">
                    <i data-lucide="table" width="28"></i>
                    <div class="export-option-label">CSV Spreadsheet</div>
                    <div class="export-option-desc">Excel-compatible data for farm management software</div>
                </button>
                <button class="export-option-btn" onclick="_shareVaultLink(); closeExportModal();">
                    <i data-lucide="share-2" width="28"></i>
                    <div class="export-option-label">Share Vault Link</div>
                    <div class="export-option-desc">Copy link to your live Google Sheet audit log</div>
                </button>
            </div>
        </div>
    `;
    return backdrop;
}

// ═══════════════════════════════════════
// SHARE VAULT LINK
// ═══════════════════════════════════════
function _shareVaultLink() {
    const vaultUrl = 'https://docs.google.com/spreadsheets/d/1NeXx4Ez2xYrbJK0LyGvqRt3KIw1lihXexv4zEbO9J-8/edit';
    if (navigator.share) {
        navigator.share({
            title: 'PFT Spray Audit Log',
            text: 'Practical Pesticide Log — Live spray record audit log',
            url: vaultUrl
        }).catch(() => { /* user cancelled share */ });
    } else if (navigator.clipboard) {
        navigator.clipboard.writeText(vaultUrl).then(() => {
            if (typeof showToast === 'function') showToast('Vault link copied ✓', 'success', 2000);
        });
    }
}

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════
function _getProfile() {
    try {
        const saved = JSON.parse(localStorage.getItem('pft_identity') || '{}');
        return {
            name: saved.name || '',
            farm: saved.farm || '',
            license: saved.license || '',
            state: saved.state || ''
        };
    } catch (_) { return { name: '', farm: '', license: '', state: '' }; }
}

function _getSprayLogs() {
    const logs = [];
    const seen = new Set();  // Dedupe by timestamp

    // Source 1: Full spray history (all synced logs)
    try {
        const history = JSON.parse(localStorage.getItem('pft_spray_history_log') || '[]');
        history.forEach(log => {
            const ts = log.Timestamp || log.timestamp;
            if (ts && !seen.has(ts)) { seen.add(ts); logs.push(log); }
        });
    } catch (_) { }

    // Source 2: Offline queue (unsent payloads)
    try {
        const queue = JSON.parse(localStorage.getItem('pft_offline_queue') || '[]');
        queue.forEach(item => {
            if (item.payload) {
                const ts = item.payload.Timestamp || item.payload.timestamp;
                if (!seen.has(ts)) { seen.add(ts); logs.push(item.payload); }
            }
        });
    } catch (_) { }

    // Source 3: Last spray (fallback if not in history yet)
    try {
        const last = JSON.parse(localStorage.getItem('pft_last_spray'));
        if (last && last.ts) {
            const isoTs = new Date(last.ts).toISOString();
            if (!seen.has(isoTs)) {
                logs.push({
                    Timestamp: isoTs,
                    Field_Name: last.fieldName || '',
                    All_Product_Names: last.product || '',
                    All_EPA_Nos: last.productEpa || '',
                    Nozzle: last.nozzle || '',
                    Tank_Water: last.tankSize || ''
                });
            }
        }
    } catch (_) { }

    // Sort newest first
    logs.sort((a, b) => {
        const ta = new Date(a.Timestamp || a.timestamp || 0).getTime();
        const tb = new Date(b.Timestamp || b.timestamp || 0).getTime();
        return tb - ta;
    });

    return logs;
}

function _formatDate(ts) {
    if (!ts) return 'N/A';
    try {
        const d = new Date(ts);
        return `${d.toLocaleDateString('en-US')} ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    } catch (_) { return ts; }
}

function _truncateGPS(gps) {
    if (!gps || gps === 'N/A') return 'N/A';
    // Shorten to 4 decimal places for readability
    return gps.replace(/(\d+\.\d{4})\d+/g, '$1');
}

function _formatWeather(log) {
    const parts = [];
    if (log.Temp_Humidity) parts.push(log.Temp_Humidity);
    else if (log.Temperature_F) parts.push(`${log.Temperature_F}°F`);
    if (log.Wind_API) parts.push(log.Wind_API);
    if (log.Wind_Visual) parts.push(`B${log.Wind_Visual}`);
    return parts.join(' | ') || 'N/A';
}

// ═══════════════════════════════════════
// EXPOSE TO GLOBAL SCOPE
// ═══════════════════════════════════════
window.generateSprayPDF = generateSprayPDF;
window.generateSprayCSV = generateSprayCSV;
window.openExportModal = openExportModal;
window.closeExportModal = closeExportModal;
