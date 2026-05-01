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
    const nyquist = sampleRate / 2;
    buildAxisTicks(containerId, ticks, (frac) => ({
        className: "freq-tick",
        posProp: "top",
        posPercent: frac * 100,
        transform: "translateY(-50%)",
        label: formatHz(Math.round(scaleToHz(1 - frac, nyquist, scale)))
    }));
}

function buildTimeAxis(containerId, secondsVisible = 8, ticks = 8, direction = "right") {
    buildAxisTicks(containerId, ticks, (frac) => {
        // frac is from 0 (left edge) to 1 (right edge).
        const s = direction === "right"
            ? (1 - frac) * secondsVisible
            : frac * secondsVisible;

        return {
            className: "time-tick",
            posProp: "left",
            posPercent: frac * 100,
            transform: "translateX(-50%)",
            label: `${s.toFixed(1)}s`
        };
    });
}

