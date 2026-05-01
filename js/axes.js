// Axes overlay drawing (frequency on left, time on bottom) + hover line.
const Axes = (() => {
    const FREQ_AXIS_W = 44;
    const TIME_AXIS_H = 28;
    const COLUMNS_PER_SECOND = 60; // Approx assuming requestAnimationFrame ~60Hz.

    function draw(ctx, canvasW, canvasH, opts) {
        const { sampleRate, scale, timeColumns, direction } = opts;
        ctx.clearRect(0, 0, canvasW, canvasH);

        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.fillRect(0, 0, FREQ_AXIS_W, canvasH - TIME_AXIS_H);
        ctx.fillRect(0, canvasH - TIME_AXIS_H, canvasW, TIME_AXIS_H);

        ctx.fillStyle = "#eee";
        ctx.font = "12px sans-serif";
        ctx.textBaseline = "middle";

        // Frequency axis
        ctx.textAlign = "right";
        const fTicks = 8;
        const nyquist = sampleRate / 2;
        const displayH = canvasH - TIME_AXIS_H;
        for (let i = 0; i < fTicks; i++) {
            const frac = i / fTicks;
            const y = frac * displayH;
            const hz = scaleToHz(1 - frac, nyquist, scale);
            const drawY = i === 0 ? y + 8 : y;
            ctx.fillText(formatHz(Math.round(hz)), FREQ_AXIS_W - 4, drawY);
        }

        // Time axis
        ctx.textBaseline = "bottom";
        const seconds = Math.max(1, timeColumns / COLUMNS_PER_SECOND);
        const tTicks = Math.min(12, Math.max(4, Math.round(seconds)));
        const displayW = canvasW - FREQ_AXIS_W;
        for (let i = 0; i <= tTicks; i++) {
            const frac = i / tTicks;
            const x = frac * displayW;
            const s = direction === "right" ? (1 - frac) * seconds : frac * seconds;
            let drawX = x + FREQ_AXIS_W;
            if (i === 0) { ctx.textAlign = "left"; drawX += 4; }
            else if (i === tTicks) { ctx.textAlign = "right"; drawX -= 4; }
            else { ctx.textAlign = "center"; }
            ctx.fillText(`${s.toFixed(1)}s`, drawX, canvasH - 6);
        }
    }

    function drawHoverLine(ctx, y, timeColumns, color = "rgba(255, 0, 0, 0.7)") {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(FREQ_AXIS_W, y);
        ctx.lineTo(timeColumns + FREQ_AXIS_W, y);
        ctx.stroke();
    }

    function formatHz(hz) {
        return hz >= 1000 ? `${(hz / 1000).toFixed(1)}k` : `${hz}`;
    }

    return { FREQ_AXIS_W, TIME_AXIS_H, COLUMNS_PER_SECOND, draw, drawHoverLine, formatHz };
})();
