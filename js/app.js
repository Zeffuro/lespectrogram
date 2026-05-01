// Main spectrogram app: audio capture, draw loop, hookup to prefs/UI.
const App = (() => {
    let audioCtx = null;
    let mediaStream = null;
    let analyser = null;
    let appState = "stopped";
    let animFrameId = null;

    let wf = null;
    let currentColor = null;
    let frqBuf = null;
    let mappedBuf = null;
    let wfBufAry = null;
    let numBins = 0;
    let pxPerLine = 0;       // canvas vertical pixels (frequency axis)
    let timeColumns = 0;     // canvas horizontal pixels (time axis)
    let currentScale = null;
    let scaleMap = null;
    let resizeTimer = null;

    let audioEl = null;
    let fileSourceNode = null;
    let micSourceNode = null;
    let overlayCanvas = null;
    let overlayCtx = null;

    function getScale() { return Prefs.get("scaleType"); }
    function getColor() { return Prefs.get("colorType"); }

    // Approximate columns/sec assuming requestAnimationFrame ~60 Hz.
    const COLUMNS_PER_SECOND = 60;
    const FREQ_AXIS_W = 44;
    const TIME_AXIS_H = 28;

    // Compute available canvas size from the viewport, leaving room for the
    // freq axis on the left, time axis below, and toolbar / page chrome.
    function computeDisplaySize() {
        const minW = 480, minH = 240;
        const maxW = 4096, maxH = 2048;

        if (!Prefs.get("autoFit")) {
            return { w: 1600, h: 600 };
        }

        const axisLeft = FREQ_AXIS_W + 12;
        const horizMargin = 32;
        const maxExpectedW = window.innerWidth - axisLeft - horizMargin;

        // Use a stable reserved vertical offset (toolbar, hints, footer) so we don't rely on current dynamic DOM flow.
        const reservedV = 360;

        const w = Math.max(minW, Math.min(maxW, Math.floor(maxExpectedW)));
        const heightAvailable = window.innerHeight - reservedV;
        const h = Math.max(minH, Math.min(maxH, Math.floor(heightAvailable)));
        return { w, h };
    }

    function buildAudioBuffers() {
        numBins = analyser.frequencyBinCount;
        const { w, h } = computeDisplaySize();
        pxPerLine = h;
        timeColumns = w;
        frqBuf = new Uint8Array(numBins);
        mappedBuf = new Uint8Array(pxPerLine);
        wfBufAry = { buffer: mappedBuf };
    }

    function drawAxesOverlay() {
        if (!overlayCanvas) return;
        const w = overlayCanvas.width;
        const h = overlayCanvas.height;
        overlayCtx.clearRect(0, 0, w, h);

        overlayCtx.fillStyle = "rgba(0, 0, 0, 0.4)";
        overlayCtx.fillRect(0, 0, FREQ_AXIS_W, h - TIME_AXIS_H);
        overlayCtx.fillRect(0, h - TIME_AXIS_H, w, TIME_AXIS_H);

        overlayCtx.fillStyle = "#eee";
        overlayCtx.font = "12px sans-serif";
        overlayCtx.textBaseline = "middle";

        // Frequency Axis
        overlayCtx.textAlign = "right";
        const ticks = 8;
        const nyquist = audioCtx ? (audioCtx.sampleRate / 2) : 24000;
        const scale = getScale();
        const displayH = h - TIME_AXIS_H;
        for (let i = 0; i < ticks; i++) {
            const frac = i / ticks;
            const y = frac * displayH;
            const hz = scaleToHz(1 - frac, nyquist, scale);
            let drawY = y;
            if (i === 0) drawY += 8;
            overlayCtx.fillText(formatHz(Math.round(hz)), FREQ_AXIS_W - 4, drawY);
        }

        // Time Axis
        overlayCtx.textBaseline = "bottom";
        const seconds = Math.max(1, timeColumns / COLUMNS_PER_SECOND);
        const tTicks = Math.min(12, Math.max(4, Math.round(seconds)));
        const dir = Prefs.get("direction") || "right";
        const displayW = w - FREQ_AXIS_W;

        for (let i = 0; i <= tTicks; i++) {
            const frac = i / tTicks;
            const x = frac * displayW;
            const s = dir === "right" ? (1 - frac) * seconds : frac * seconds;
            let drawX = x + FREQ_AXIS_W;

            if (i === 0) {
                overlayCtx.textAlign = "left";
                drawX += 4;
            } else if (i === tTicks) {
                overlayCtx.textAlign = "right";
                drawX -= 4;
            } else {
                overlayCtx.textAlign = "center";
            }

            overlayCtx.fillText(`${s.toFixed(1)}s`, drawX, h - 6);
        }
    }

    function createWaterfall() {
        if (wf) wf.stop();
        const root = document.getElementById("root");
        root.innerHTML = "";
        
        const opts = { onscreenParentId: "root" };
        const cmap = COLOR_MAPS[getColor()];
        if (cmap) opts.colorMap = cmap;
        wf = new Waterfall(wfBufAry, pxPerLine, timeColumns, Prefs.get("direction") || "right", opts);
        currentColor = getColor();
        
        // Grab or create axes canvas
        overlayCanvas = document.getElementById("axesCanvas");
        if (overlayCanvas) {
            overlayCanvas.width = timeColumns + FREQ_AXIS_W;
            overlayCanvas.height = pxPerLine + TIME_AXIS_H;
            overlayCtx = overlayCanvas.getContext("2d");
        }

        drawAxesOverlay();

        wf.start();
    }

    function rebuildScale() {
        scaleMap = buildScaleMap(numBins, pxPerLine, audioCtx.sampleRate, getScale());
        currentScale = getScale();
        drawAxesOverlay();
    }

    function refreshTimeAxis() {
        drawAxesOverlay();
    }

    // Handle mouse hover overlay
    function attachTooltipEvents() {
        const root = document.getElementById("root");
        const tooltip = document.getElementById("spectroTooltip");
        if (!root || !tooltip) return;

        root.addEventListener("mousemove", (e) => {
            if (appState === "stopped" || !audioCtx || !overlayCanvas || !overlayCtx) {
                tooltip.style.display = "none";
                drawAxesOverlay();
                return;
            }

            const rect = root.getBoundingClientRect();
            let y = e.clientY - rect.top;
            y = Math.max(0, Math.min(pxPerLine - 1, y));

            drawAxesOverlay();
            if (Prefs.get("showHoverLine")) {
                overlayCtx.strokeStyle = "rgba(255, 0, 0, 0.7)";
                overlayCtx.lineWidth = 1;
                overlayCtx.beginPath();
                overlayCtx.moveTo(FREQ_AXIS_W, y);
                overlayCtx.lineTo(timeColumns + FREQ_AXIS_W, y);
                overlayCtx.stroke();
            }

            if (Prefs.get("showTooltip")) {
                // Waterfall visually draws top (0) = highest frequency (Nyquist).
                const frac = 1 - (y / Math.max(1, pxPerLine - 1));
                const hz = scaleToHz(frac, audioCtx.sampleRate / 2, getScale());
                tooltip.textContent = hzToNoteString(hz);
                tooltip.style.left = `${e.clientX + 15}px`;
                tooltip.style.top = `${e.clientY + 15}px`;
                tooltip.style.display = "block";
            } else {
                tooltip.style.display = "none";
            }
        });

        root.addEventListener("mouseleave", () => {
            tooltip.style.display = "none";
            if (overlayCtx) drawAxesOverlay();
        });
    }

    // Full pipeline rebuild for fftSize / resize / autoFit changes.
    function rebuildPipeline() {
        if (!analyser) return;
        analyser.fftSize = Prefs.get("fftSize");
        analyser.smoothingTimeConstant = Prefs.get("smoothing");
        buildAudioBuffers();
        rebuildScale();
        refreshTimeAxis();
        createWaterfall();
    }

    function updateButtons() {
        const start = document.getElementById("startBtn");
        const pause = document.getElementById("pauseBtn");
        const stop  = document.getElementById("stopBtn");
        start.disabled = appState === "running";
        pause.disabled = appState === "stopped";
        pause.textContent = appState === "paused" ? "Resume" : "Pause";
        stop.disabled  = appState === "stopped";
    }

    function showRestartHint(show) {
        const el = document.getElementById("restartHint");
        if (el) el.style.display = show ? "" : "none";
    }

    let lastNoteUpdateTs = 0;

    function updateLastNote() {
        if (!analyser || !frqBuf) return;
        const now = performance.now();
        if (now - lastNoteUpdateTs < 100) return;
        lastNoteUpdateTs = now;

        const sampleRate = audioCtx.sampleRate;
        const fftSize = analyser.fftSize;
        const binHz = sampleRate / fftSize;

        // Search range for fundamental: ~50 Hz .. 2000 Hz (vocal range + headroom).
        const minBin = Math.max(2, Math.floor(50 / binHz));
        const maxBin = Math.min(frqBuf.length - 1, Math.floor(2000 / binHz));

        // Quick silence check using raw spectrum max.
        let rawMax = 0;
        for (let i = minBin; i < frqBuf.length; i++) {
            if (frqBuf[i] > rawMax) rawMax = frqBuf[i];
        }
        if (rawMax < 80) return;

        // Harmonic Product Spectrum: multiply downsampled copies so the
        // fundamental (whose harmonics line up at k, 2k, 3k...) wins over
        // an overtone peak.
        const H = 5;
        const upper = Math.min(maxBin, Math.floor((frqBuf.length - 1) / H));
        let bestK = -1, bestScore = 0;
        for (let k = minBin; k <= upper; k++) {
            let score = 1;
            for (let h = 1; h <= H; h++) {
                score *= (frqBuf[k * h] + 1);
            }
            if (score > bestScore) { bestScore = score; bestK = k; }
        }
        if (bestK < 0) return;

        // Parabolic interpolation around bestK for sub-bin precision.
        let refined = bestK;
        if (bestK > 0 && bestK < frqBuf.length - 1) {
            const a = frqBuf[bestK - 1], b = frqBuf[bestK], c = frqBuf[bestK + 1];
            const denom = (a - 2 * b + c);
            if (denom !== 0) {
                const delta = 0.5 * (a - c) / denom;
                if (delta > -1 && delta < 1) refined = bestK + delta;
            }
        }

        const hz = refined * binHz;
        const wrap = document.getElementById("lastNoteWrap");
        const txt = document.getElementById("lastNoteText");
        if (!wrap || !txt) return;
        txt.textContent = hzToNoteString(hz);
        if (wrap.style.display === "none") wrap.style.display = "";
    }

    function draw() {
        if (appState !== "running") return;
        if (getScale() !== currentScale) rebuildScale();
        if (getColor() !== currentColor) createWaterfall();
        analyser.getByteFrequencyData(frqBuf);
        remapBins(frqBuf, mappedBuf, scaleMap);
        updateLastNote();

        if (audioEl && (audioEl.paused || audioEl.ended) && appState === "running") {
            pause();
            return;
        }

        animFrameId = requestAnimationFrame(draw);
    }

    function audioConstraints() {
        return {
            echoCancellation: !!Prefs.get("echoCancellation"),
            noiseSuppression: !!Prefs.get("noiseSuppression"),
            autoGainControl:  !!Prefs.get("autoGainControl")
        };
    }

    async function start() {
        if (appState === "paused") {
            await audioCtx.resume();
            if (audioEl) audioEl.play();
            appState = "running";
            if (wf) wf.start();
            updateButtons();
            draw();
            return;
        }

        if (!audioCtx) {
            audioCtx = new AudioContext();
            analyser = audioCtx.createAnalyser();
        }
        analyser.fftSize = Prefs.get("fftSize");
        analyser.smoothingTimeConstant = Prefs.get("smoothing");

        if (audioEl) {
            if (micSourceNode) micSourceNode.disconnect();
            analyser.disconnect();

            if (!fileSourceNode) {
                fileSourceNode = audioCtx.createMediaElementSource(audioEl);
            }
            fileSourceNode.disconnect();
            fileSourceNode.connect(analyser);
            analyser.connect(audioCtx.destination);

            try { await audioCtx.resume(); } catch(e){}
            audioEl.play();

            buildAudioBuffers();
            rebuildScale();
            refreshTimeAxis();
            createWaterfall();
            appState = "running";
            showRestartHint(false);
            updateButtons();
            draw();
            return;
        }

        setMicHint("waiting");
        try {
            mediaStream = await navigator.mediaDevices.getUserMedia({
                video: false,
                audio: audioConstraints()
            });
        } catch { setMicHint("denied"); return; }

        try { await audioCtx.resume(); } catch(e){}
        setMicHint("granted");

        analyser.disconnect(); // ensure we don't play mic out to speakers
        if (fileSourceNode) fileSourceNode.disconnect();
        if (micSourceNode) micSourceNode.disconnect();

        micSourceNode = audioCtx.createMediaStreamSource(mediaStream);
        micSourceNode.connect(analyser);

        buildAudioBuffers();
        rebuildScale();
        refreshTimeAxis();
        createWaterfall();
        appState = "running";
        showRestartHint(false);
        updateButtons();
        draw();
    }

    async function pause() {
        if (appState !== "running") return;
        appState = "paused";
        if (animFrameId) cancelAnimationFrame(animFrameId);
        if (wf) wf.stop();
        // audioCtx suspend logic
        if (audioCtx && audioCtx.state === "running") {
            audioCtx.suspend().catch(e => console.warn(e));
        }
        if (audioEl) audioEl.pause();
        updateButtons();
    }

    function clearDisplay() {
        if (wf) { wf.stop(); wf.clear(); }
        document.getElementById("root").innerHTML = "";
        const c = document.getElementById("axesCanvas");
        if (c) {
            const ctx = c.getContext("2d");
            ctx.clearRect(0, 0, c.width, c.height);
        }
    }

    function stop() {
        appState = "stopped";
        if (animFrameId) cancelAnimationFrame(animFrameId);
        if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }
        if (audioEl) {
            audioEl.pause();
            audioEl.currentTime = 0;
        }
        clearDisplay();
        showRestartHint(false);
        updateButtons();
        if (!audioEl) checkMicPermission();
    }

    function reset() {
        if (wf) wf.clear();
        if (appState === "stopped") clearDisplay();
    }

    let droppedFile = null;

    function setFileBarVisible(visible) {
        const bar = document.getElementById("audioFileBar");
        if (bar) bar.classList.toggle("d-none", !visible);
    }

    function formatTime(s) {
        if (!s || isNaN(s)) return "0:00";
        const mins = Math.floor(s / 60);
        const secs = Math.floor(s % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    }

    async function handleFileUpload(file) {
        if (!file || !file.type.startsWith("audio/")) return;

        stop();
        clearDisplay();

        if (!audioCtx) {
            audioCtx = new AudioContext();
            analyser = audioCtx.createAnalyser();
        }

        droppedFile = file;
        document.getElementById("audioPlayerName").textContent = file.name;
        setFileBarVisible(true);

        if (!audioEl) {
            audioEl = document.getElementById("audioPlayer");
            audioEl.addEventListener('play', () => { if (appState !== "running") start(); });
            audioEl.addEventListener('pause', () => { if (appState === "running") pause(); });
            audioEl.addEventListener('seeked', () => {
                if (appState !== "running" && !audioEl.paused) start();
            });
            audioEl.addEventListener('ended', pause);

            const scrubber = document.getElementById("customAudioScrubber");
            const audioTime = document.getElementById("customAudioTime");

            audioEl.addEventListener('timeupdate', () => {
                if (audioEl.duration) {
                    scrubber.value = (audioEl.currentTime / audioEl.duration) * 100;
                    audioTime.textContent = `${formatTime(audioEl.currentTime)} / ${formatTime(audioEl.duration)}`;
                }
            });

            scrubber.addEventListener('input', () => {
                if (audioEl.duration) {
                    audioEl.currentTime = (scrubber.value / 100) * audioEl.duration;
                }
            });
        }

        audioEl.src = URL.createObjectURL(file);

        start();
    }

    function onPrefChanged(key, value) {
        if (appState === "stopped" || !analyser) return;

        if (key === "smoothing") {
            analyser.smoothingTimeConstant = value;
        } else if (key === "fftSize" || key === "autoFit" || key === "direction") {
            rebuildPipeline();
        } else if (key === "echoCancellation" || key === "noiseSuppression" || key === "autoGainControl") {
            showRestartHint(true);
        }
    }

    function onWindowResize() {
        if (!Prefs.get("autoFit")) return;
        if (appState === "stopped" || !analyser) return;
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => rebuildPipeline(), 150);
    }

    function init() {
        Prefs.load();

        document.getElementById("startBtn").addEventListener('click', start);

        document.getElementById("pauseBtn").addEventListener('click', () => {
            if (appState === "running") pause();
            else if (appState === "paused") start();
        });

        document.getElementById("stopBtn").addEventListener('click', stop);
        document.getElementById("resetBtn").addEventListener('click', reset);

        document.getElementById("openFileBtn").addEventListener('click', () => {
            document.getElementById("audioFileInput").click();
        });
        document.getElementById("audioFileInput").addEventListener('change', (e) => {
            handleFileUpload(e.target.files[0]);
        });

        const closeAudioBtn = document.getElementById("closeAudioBtn");
        if (closeAudioBtn) {
            closeAudioBtn.addEventListener('click', () => {
                stop();
                if (audioEl) {
                    audioEl.src = "";
                    audioEl = null;
                }
                droppedFile = null;
                setFileBarVisible(false);
                document.getElementById("audioFileInput").value = "";
                checkMicPermission();
            });
        }

        wireDropdown("data-scale", "scaleLabel", SCALE_NAMES, v => Prefs.set("scaleType", v));
        wireDropdown("data-color", "colorLabel", COLOR_NAMES, v => Prefs.set("colorType", v));
        wireSettingsPanel(onPrefChanged);
        applyPrefsToUI();

        attachTooltipEvents();

        window.addEventListener('resize', onWindowResize);

        if (!droppedFile) setFileBarVisible(false);

        updateButtons();
        checkMicPermission();
    }

    return { init };
})();

window.addEventListener('DOMContentLoaded', App.init);

