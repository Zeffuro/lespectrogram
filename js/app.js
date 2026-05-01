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

    function getScale() { return Prefs.get("scaleType"); }
    function getColor() { return Prefs.get("colorType"); }

    // Approximate columns/sec assuming requestAnimationFrame ~60 Hz.
    const COLUMNS_PER_SECOND = 60;

    // Compute available canvas size from the viewport, leaving room for the
    // freq axis on the left, time axis below, and toolbar / page chrome.
    function computeDisplaySize() {
        const minW = 480, minH = 240;
        const maxW = 4096, maxH = 2048;

        if (!Prefs.get("autoFit")) {
            return { w: 1600, h: 600 };
        }

        const axisLeft = 64 + 12;
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

    function createWaterfall() {
        if (wf) wf.stop();
        document.getElementById("root").innerHTML = "";
        const opts = { onscreenParentId: "root" };
        const cmap = COLOR_MAPS[getColor()];
        if (cmap) opts.colorMap = cmap;
        wf = new Waterfall(wfBufAry, pxPerLine, timeColumns, Prefs.get("direction") || "right", opts);
        currentColor = getColor();
        wf.start();
    }

    function rebuildScale() {
        scaleMap = buildScaleMap(numBins, pxPerLine, audioCtx.sampleRate, getScale());
        currentScale = getScale();
        buildFreqAxis("freqAxis", audioCtx.sampleRate, getScale(), pxPerLine, 8);
    }

    function refreshTimeAxis() {
        const seconds = Math.max(1, timeColumns / COLUMNS_PER_SECOND);
        const ticks = Math.min(12, Math.max(4, Math.round(seconds)));
        buildTimeAxis("timeAxis", seconds, ticks, Prefs.get("direction") || "right");
    }

    // Handle mouse hover overlay
    function attachTooltipEvents() {
        const root = document.getElementById("root");
        const tooltip = document.getElementById("spectroTooltip");
        if (!root || !tooltip) return;

        root.addEventListener("mousemove", (e) => {
            if (!Prefs.get("showTooltip") || appState === "stopped" || !audioCtx) {
                tooltip.style.display = "none";
                return;
            }

            const rect = root.getBoundingClientRect();
            let y = e.clientY - rect.top;
            y = Math.max(0, Math.min(pxPerLine - 1, y));

            // Waterfall visually draws top (0) = highest frequency (Nyquist).
            const frac = 1 - (y / Math.max(1, pxPerLine - 1));
            const hz = scaleToHz(frac, audioCtx.sampleRate / 2, getScale());

            tooltip.textContent = hzToNoteString(hz);
            tooltip.style.left = `${e.clientX + 15}px`;
            tooltip.style.top = `${e.clientY + 15}px`;
            tooltip.style.display = "block";
        });

        root.addEventListener("mouseleave", () => {
            tooltip.style.display = "none";
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

    function draw() {
        if (appState !== "running") return;
        if (getScale() !== currentScale) rebuildScale();
        if (getColor() !== currentColor) createWaterfall();
        analyser.getByteFrequencyData(frqBuf);
        remapBins(frqBuf, mappedBuf, scaleMap);

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
            wf.start();
            updateButtons();
            draw();
            return;
        }

        if (audioEl) {
            // First time loading file
            if (!audioCtx) {
                const ac = new AudioContext();
                analyser = ac.createAnalyser();
                analyser.fftSize = Prefs.get("fftSize");
                analyser.smoothingTimeConstant = Prefs.get("smoothing");

                ac.createMediaElementSource(audioEl).connect(analyser);
                analyser.connect(ac.destination);

                audioCtx = ac;
            }

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
            audioCtx = new AudioContext();
            mediaStream = await navigator.mediaDevices.getUserMedia({
                video: false,
                audio: audioConstraints()
            });
        } catch { setMicHint("denied"); return; }

        setMicHint("granted");
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = Prefs.get("fftSize");
        analyser.smoothingTimeConstant = Prefs.get("smoothing");
        audioCtx.createMediaStreamSource(mediaStream).connect(analyser);

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
        if (appState === "running") {
            appState = "paused";
            if (animFrameId) cancelAnimationFrame(animFrameId);
            wf.stop();
            await audioCtx.suspend();
            if (audioEl) audioEl.pause();
            updateButtons();
        } else if (appState === "paused") {
            await start();
        }
    }

    function clearDisplay() {
        if (wf) { wf.stop(); wf.clear(); }
        document.getElementById("root").innerHTML = "";
        const timeAxis = document.getElementById("timeAxis");
        if (timeAxis) timeAxis.innerHTML = "";
        const freqAxis = document.getElementById("freqAxis");
        if (freqAxis) freqAxis.innerHTML = "";
    }

    function stop() {
        appState = "stopped";
        if (animFrameId) cancelAnimationFrame(animFrameId);
        if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }
        if (audioCtx && !audioEl) { audioCtx.close(); audioCtx = null; }
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

    function handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        stop(); // stop existing session
        reset();

        document.getElementById("audioPlayerWrap").style.display = "";
        document.getElementById("audioPlayerName").textContent = file.name;

        const hintEl = document.getElementById("micHint");
        if (hintEl) hintEl.style.display = "none"; // Hide mic hints

        if (!audioEl) {
            audioEl = document.getElementById("audioPlayer");
            audioEl.addEventListener('play', () => { if (appState !== "running") start(); });
            audioEl.addEventListener('pause', () => { if (appState === "running") pause(); });
            audioEl.addEventListener('seeked', () => {
                if (wf) wf.clear();
                if (appState !== "running" && !audioEl.paused) start();
            });
            audioEl.addEventListener('ended', pause);
        }

        audioEl.src = URL.createObjectURL(file);

        start().catch(e => console.warn("Autoplay blocked", e));
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
        document.getElementById("pauseBtn").addEventListener('click', pause);
        document.getElementById("stopBtn").addEventListener('click', stop);
        document.getElementById("resetBtn").addEventListener('click', reset);

        document.getElementById("openFileBtn").addEventListener('click', () => {
            document.getElementById("audioFileInput").click();
        });
        document.getElementById("audioFileInput").addEventListener('change', handleFileUpload);

        const closeAudioBtn = document.getElementById("closeAudioBtn");
        if (closeAudioBtn) {
            closeAudioBtn.addEventListener('click', () => {
                stop();
                if (audioEl) {
                    audioEl.src = "";
                    audioEl = null;
                }
                document.getElementById("audioPlayerWrap").style.display = "none";
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

        updateButtons();
        checkMicPermission();
    }

    return { init };
})();

window.addEventListener('DOMContentLoaded', App.init);

