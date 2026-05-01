// Frequency / time axis tick rendering.
function buildAxisTicks(containerId, ticks, makeTick) {
    const axis = document.getElementById(containerId);
    if (!axis) return;
    axis.innerHTML = "";
    for (let i = 0; i <= ticks; i++) {
        const cfg = makeTick(i / ticks);
        const el = document.createElement("div");
        el.className = cfg.className;
        el.style.cssText = `position:absolute;${cfg.posProp}:${cfg.posPercent}%;transform:${cfg.transform}`;
        el.textContent = cfg.label;
        axis.appendChild(el);
    }
}

function formatHz(hz) {
    return hz >= 1000 ? `${(hz / 1000).toFixed(1)}k` : `${hz}`;
}

function buildFreqAxis(containerId, sampleRate, scale, numPx, ticks = 6) {
    // Replaced by canvas drawing in app.js
}

function buildTimeAxis(containerId, secondsVisible = 8, ticks = 8, direction = "right") {
    // Replaced by canvas drawing in app.js
}
