/**
 * Practical Farm Tools — Voice-First Field Mode
 * Hands-free spray logging via Deepgram Nova-3.
 * Designed for tractor-cab noise environments — engine roar,
 * wind, PTO vibration. Nova-3's noise suppression handles it all.
 * © 2026 Practical Farm Tools. All rights reserved.
 *
 * Voice Commands:
 *   "Log spray [field], [product], [acreage] acres"
 *   "Search [product name]"
 *   "Set field [field name]"
 *   "Lock GPS"
 */

// ═══════════════════════════════════════
// DEEPGRAM NOVA-3 STREAMING ENGINE
// ═══════════════════════════════════════

const DEEPGRAM_MODEL = 'nova-3';
const DEEPGRAM_WS_URL = 'wss://api.deepgram.com/v1/listen';

let _dgSocket = null;
let _mediaStream = null;
let _mediaRecorder = null;
let _isListening = false;
let _voiceFAB = null;
let _voiceOverlay = null;

// API key is loaded from the Vercel proxy to avoid exposure.
// Fallback: direct key for local dev only.
let _dgApiKey = null;

/**
 * initVoiceEngine()
 * Call once on DOMContentLoaded. Creates the mic FAB and verifies
 * microphone availability. Deepgram connection is lazy — opened on tap.
 */
function initVoiceEngine() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;

    // Try to load API key from proxy or localStorage
    _dgApiKey = localStorage.getItem('pft_dg_key') || null;

    _createVoiceFAB();
    _createVoiceOverlay();
}

// ═══════════════════════════════════════
// UI ELEMENTS
// ═══════════════════════════════════════

function _createVoiceFAB() {
    if (document.getElementById('voice-fab')) return; // Guard: prevent duplicate
    const fab = document.createElement('button');
    fab.id = 'voice-fab';
    fab.className = 'voice-fab';
    fab.innerHTML = '<i data-lucide="mic" width="22"></i>';
    fab.title = 'Talk to Log (Deepgram Nova-3)';
    fab.addEventListener('click', toggleVoiceMode);
    document.body.appendChild(fab);
    _voiceFAB = fab;
    if (typeof refreshIcons === 'function') refreshIcons();
}

function _createVoiceOverlay() {
    if (document.getElementById('voice-overlay')) return; // Guard: prevent duplicate
    const overlay = document.createElement('div');
    overlay.id = 'voice-overlay';
    overlay.className = 'voice-overlay';
    overlay.innerHTML = `
        <div class="voice-overlay-card">
            <div class="voice-pulse-ring"></div>
            <div class="voice-icon-wrap">
                <i data-lucide="mic" width="36"></i>
            </div>
            <div class="voice-status" id="voice-status">Listening...</div>
            <div class="voice-transcript" id="voice-transcript"></div>
            <div class="voice-hint">Try: "Log spray, North Field, Bravo 500, 20 acres"</div>
            <div class="voice-engine-badge">🔊 Deepgram Nova-3 · Noise-Hardened</div>
            <button class="voice-cancel-btn" onclick="stopVoiceMode()">Cancel</button>
        </div>
    `;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) stopVoiceMode(); });
    document.body.appendChild(overlay);
    _voiceOverlay = overlay;
    if (typeof refreshIcons === 'function') refreshIcons();
}

// ═══════════════════════════════════════
// VOICE CONTROL
// ═══════════════════════════════════════

function toggleVoiceMode() {
    if (_isListening) {
        stopVoiceMode();
    } else {
        startVoiceMode();
    }
}

async function startVoiceMode() {
    // Prompt for API key if not set
    if (!_dgApiKey) {
        _dgApiKey = prompt('Enter your Deepgram API key (one-time setup):');
        if (!_dgApiKey) return;
        localStorage.setItem('pft_dg_key', _dgApiKey);
    }

    _isListening = true;
    _voiceFAB?.classList.add('listening');
    _voiceOverlay?.classList.add('show');

    const transcript = document.getElementById('voice-transcript');
    if (transcript) transcript.textContent = '';
    const status = document.getElementById('voice-status');
    if (status) status.textContent = 'Connecting to Deepgram...';

    if ('vibrate' in navigator) navigator.vibrate([30, 50, 30]);

    try {
        // Get microphone stream
        _mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1,
                sampleRate: 16000,
                echoCancellation: true,
                noiseSuppression: true,   // Browser-level pre-filter
                autoGainControl: true     // Normalize volume in loud cabs
            }
        });

        // Open Deepgram WebSocket
        const params = new URLSearchParams({
            model: DEEPGRAM_MODEL,
            language: 'en-US',
            smart_format: 'true',
            punctuate: 'true',
            utterances: 'true',
            interim_results: 'true',
            endpointing: '500',          // 500ms silence = end of utterance
            vad_events: 'true',          // Voice Activity Detection
            encoding: 'linear16',
            sample_rate: '16000',
            channels: '1'
        });

        _dgSocket = new WebSocket(`${DEEPGRAM_WS_URL}?${params.toString()}`, ['token', _dgApiKey]);

        _dgSocket.onopen = () => {
            if (status) status.textContent = '🎤 Listening — speak clearly';
            _startMediaRecording();
        };

        _dgSocket.onmessage = (event) => {
            _handleDeepgramResult(JSON.parse(event.data));
        };

        _dgSocket.onerror = () => {
            if (status) status.textContent = '⚠ Connection error — retrying...';
        };

        _dgSocket.onclose = (event) => {
            if (event.code !== 1000 && _isListening) {
                if (status) status.textContent = 'Connection closed — tap to retry';
            }
            _stopMediaRecording();
        };

    } catch (err) {
        if (status) status.textContent = 'Microphone access denied';
        if (typeof showToast === 'function') showToast('Enable microphone in browser settings', 'error', 4000);
        stopVoiceMode();
    }
}

function stopVoiceMode() {
    _isListening = false;
    _stopMediaRecording();

    if (_dgSocket && _dgSocket.readyState === WebSocket.OPEN) {
        // Send close frame to Deepgram
        _dgSocket.close(1000);
    }
    _dgSocket = null;

    _stopListeningUI();
}

function _stopListeningUI() {
    _isListening = false;
    _voiceFAB?.classList.remove('listening');
    _voiceOverlay?.classList.remove('show');
}

// ═══════════════════════════════════════
// MEDIA RECORDING (Mic → WebSocket)
// ═══════════════════════════════════════

function _startMediaRecording() {
    if (!_mediaStream) return;

    try {
        // Use AudioWorklet for precise 16-bit PCM streaming
        const audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: 16000
        });

        const source = audioContext.createMediaStreamSource(_mediaStream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);

        processor.onaudioprocess = (e) => {
            if (_dgSocket?.readyState === WebSocket.OPEN) {
                const inputData = e.inputBuffer.getChannelData(0);
                // Convert float32 to int16 PCM
                const pcm16 = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                    const s = Math.max(-1, Math.min(1, inputData[i]));
                    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }
                _dgSocket.send(pcm16.buffer);
            }
        };

        source.connect(processor);
        processor.connect(audioContext.destination);

        // Store for cleanup
        _mediaRecorder = { audioContext, source, processor };
    } catch (_) {
        // Fallback: MediaRecorder API
        _startFallbackRecording();
    }
}

function _startFallbackRecording() {
    if (!_mediaStream) return;
    try {
        const recorder = new MediaRecorder(_mediaStream, { mimeType: 'audio/webm;codecs=opus' });
        recorder.ondataavailable = (e) => {
            if (e.data.size > 0 && _dgSocket?.readyState === WebSocket.OPEN) {
                _dgSocket.send(e.data);
            }
        };
        recorder.start(250); // 250ms chunks for low latency
        _mediaRecorder = recorder;
    } catch (_) { }
}

function _stopMediaRecording() {
    if (_mediaRecorder) {
        if (_mediaRecorder.audioContext) {
            // ScriptProcessor cleanup
            _mediaRecorder.processor?.disconnect();
            _mediaRecorder.source?.disconnect();
            _mediaRecorder.audioContext.close().catch(() => { });
        } else if (_mediaRecorder.stop) {
            // MediaRecorder cleanup
            try { _mediaRecorder.stop(); } catch (_) { }
        }
        _mediaRecorder = null;
    }
    if (_mediaStream) {
        _mediaStream.getTracks().forEach(t => t.stop());
        _mediaStream = null;
    }
}

// ═══════════════════════════════════════
// DEEPGRAM RESULT HANDLER
// ═══════════════════════════════════════

function _handleDeepgramResult(data) {
    if (!data?.channel?.alternatives?.length) return;

    const alt = data.channel.alternatives[0];
    const text = alt.transcript?.trim();
    if (!text) return;

    const isFinal = data.is_final;
    const transcriptEl = document.getElementById('voice-transcript');
    const statusEl = document.getElementById('voice-status');

    if (transcriptEl) transcriptEl.textContent = text;

    // Only parse on final results
    if (!isFinal) return;

    // Check for speech_final (end of utterance via endpointing)
    if (data.speech_final) {
        const parsed = _parseVoiceCommand(text);

        if (parsed.action === 'log') {
            if (statusEl) statusEl.textContent = '✓ Processing spray log...';
            _executeVoiceLog(parsed);
        } else if (parsed.action === 'search') {
            if (statusEl) statusEl.textContent = `🔍 Searching: ${parsed.query}`;
            _executeVoiceSearch(parsed.query);
        } else if (parsed.action === 'field') {
            if (statusEl) statusEl.textContent = `📍 Field set: ${parsed.fieldName}`;
            _executeVoiceField(parsed.fieldName);
        } else if (parsed.action === 'gps') {
            if (statusEl) statusEl.textContent = '📡 Locking GPS...';
            _executeVoiceGPS();
        } else {
            // Unrecognized — try smart search as fallback
            if (statusEl) statusEl.textContent = `🔍 Searching: ${text}`;
            _executeVoiceSearch(text);
        }

        // Auto-close after 1.5s
        setTimeout(() => stopVoiceMode(), 1500);
    }
}

// ═══════════════════════════════════════
// VOICE COMMAND PARSER
// ═══════════════════════════════════════

/**
 * _parseVoiceCommand(text)
 * Extracts intent from transcribed text using pattern matching.
 *
 * Patterns:
 *   "log spray [field], [product], [number] acres"
 *   "search [product name]"
 *   "set field [field name]"
 *   "lock gps" / "find my field"
 */
function _parseVoiceCommand(text) {
    const lower = text.toLowerCase();

    // GPS lock
    if (lower.includes('lock gps') || lower.includes('find my field') || lower.includes('locate')) {
        return { action: 'gps' };
    }

    // Set field
    const fieldMatch = lower.match(/(?:set field|field name|name field)\s+(.+)/i);
    if (fieldMatch) {
        return { action: 'field', fieldName: fieldMatch[1].trim() };
    }

    // Search product
    const searchMatch = lower.match(/(?:search|find|look up|lookup)\s+(.+)/i);
    if (searchMatch) {
        return { action: 'search', query: searchMatch[1].trim() };
    }

    // Log spray: "log spray, North Field, Bravo 500, 20 acres"
    const logMatch = lower.match(/(?:log|record|spray)\s*(?:spray)?\s*,?\s*(.+)/i);
    if (logMatch) {
        const parts = logMatch[1].split(/[,]+/).map(p => p.trim()).filter(Boolean);
        const result = { action: 'log', fieldName: '', productQuery: '', acreage: null };

        parts.forEach(part => {
            const acreMatch = part.match(/([\d.]+)\s*acres?/i);
            if (acreMatch) {
                result.acreage = parseFloat(acreMatch[1]);
            } else if (!result.fieldName) {
                result.fieldName = part;
            } else {
                result.productQuery = part;
            }
        });

        if (result.productQuery || result.fieldName) return result;
    }

    return { action: 'unknown' };
}

// ═══════════════════════════════════════
// VOICE COMMAND EXECUTORS
// ═══════════════════════════════════════

function _executeVoiceLog(parsed) {
    if (parsed.fieldName) _executeVoiceField(parsed.fieldName);

    if (parsed.productQuery) {
        const match = _fuzzyMatchProduct(parsed.productQuery);
        if (match) {
            if (typeof addToTankMix === 'function') addToTankMix(match.name, match.epa);
            if (typeof addToRecentSearches === 'function') addToRecentSearches(match.name, match.epa);
            if (typeof initiateLabelScan === 'function') initiateLabelScan(match.epa);
            if (typeof showToast === 'function') showToast(`🎤 Added: ${match.name}`, 'success', 2500);
        } else {
            _executeVoiceSearch(parsed.productQuery);
        }
    }

    if ('vibrate' in navigator) navigator.vibrate([40, 60, 40]);
}

function _executeVoiceSearch(query) {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.value = query;
        searchInput.dispatchEvent(new Event('input'));
    }
}

function _executeVoiceField(fieldName) {
    const fieldInput = document.getElementById('field-name-input');
    if (fieldInput) {
        fieldInput.value = fieldName;
        fieldInput.dispatchEvent(new Event('input'));
    }
    if (typeof showToast === 'function') showToast(`📍 Field: ${fieldName}`, 'info', 2000);
}

function _executeVoiceGPS() {
    const locateBtn = document.getElementById('locate-btn');
    if (locateBtn) locateBtn.click();
}

// ═══════════════════════════════════════
// FUZZY PRODUCT MATCHER
// ═══════════════════════════════════════

/**
 * _fuzzyMatchProduct(query)
 * Matches a spoken product name against the PRODUCT_CATALOG
 * using case-insensitive substring + word-level scoring.
 */
function _fuzzyMatchProduct(query) {
    if (typeof PRODUCT_CATALOG === 'undefined') return null;

    const q = query.toUpperCase().replace(/[^A-Z0-9\s]/g, '');
    let bestMatch = null;
    let bestScore = -Infinity;

    PRODUCT_CATALOG.forEach(product => {
        const name = product.name.toUpperCase();
        let score = 0;

        if (name.includes(q)) score += 100;

        const qWords = q.split(/\s+/);
        const nWords = name.split(/\s+/);
        qWords.forEach(qw => {
            nWords.forEach(nw => {
                if (nw.includes(qw)) score += 30;
                else if (qw.includes(nw)) score += 20;
                else if (qw.length >= 3 && nw.length >= 3 && qw.substring(0, 3) === nw.substring(0, 3)) score += 10;
            });
        });

        if (product.epa && product.epa.includes(q)) score += 150;
        if (product.ai && product.ai.toUpperCase().includes(q)) score += 50;

        if (score > bestScore) {
            bestScore = score;
            bestMatch = product;
        }
    });

    return bestScore >= 20 ? bestMatch : null;
}

// ═══════════════════════════════════════
// EXPOSE TO GLOBAL SCOPE
// ═══════════════════════════════════════
window.initVoiceEngine = initVoiceEngine;
window.toggleVoiceMode = toggleVoiceMode;
window.startVoiceMode = startVoiceMode;
window.stopVoiceMode = stopVoiceMode;
