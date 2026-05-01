// Fundamental pitch detection via Harmonic Product Spectrum.
const Pitch = (() => {
    const DEFAULTS = {
        minHz: 50,
        maxHz: 2000,
        harmonics: 5,
        silenceThreshold: 80
    };

    // Returns { hz, bin, magnitude } or null if silent / undetectable.
    function detect(frqBuf, sampleRate, fftSize, opts = {}) {
        const o = { ...DEFAULTS, ...opts };
        const binHz = sampleRate / fftSize;
        const minBin = Math.max(2, Math.floor(o.minHz / binHz));
        const maxBin = Math.min(frqBuf.length - 1, Math.floor(o.maxHz / binHz));

        let rawMax = 0;
        for (let i = minBin; i < frqBuf.length; i++) {
            if (frqBuf[i] > rawMax) rawMax = frqBuf[i];
        }
        if (rawMax < o.silenceThreshold) return null;

        const upper = Math.min(maxBin, Math.floor((frqBuf.length - 1) / o.harmonics));
        let bestK = -1, bestScore = 0;
        for (let k = minBin; k <= upper; k++) {
            let score = 1;
            for (let h = 1; h <= o.harmonics; h++) {
                score *= (frqBuf[k * h] + 1);
            }
            if (score > bestScore) { bestScore = score; bestK = k; }
        }
        if (bestK < 0) return null;

        // Parabolic interpolation for sub-bin precision.
        let refined = bestK;
        if (bestK > 0 && bestK < frqBuf.length - 1) {
            const a = frqBuf[bestK - 1], b = frqBuf[bestK], c = frqBuf[bestK + 1];
            const denom = (a - 2 * b + c);
            if (denom !== 0) {
                const delta = 0.5 * (a - c) / denom;
                if (delta > -1 && delta < 1) refined = bestK + delta;
            }
        }

        return { hz: refined * binHz, bin: refined, magnitude: rawMax };
    }

    return { detect };
})();

