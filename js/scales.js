// Frequency-axis scale conversion and bin remapping.
const SCALE_NAMES = { MEL: "Mel", LINEAR: "Linear", OCTAVE: "Octave", LOG: "Log" };

function hzToMel(hz) { return 2595 * Math.log10(1 + hz / 700); }
function melToHz(mel) { return 700 * (Math.pow(10, mel / 2595) - 1); }

function scaleToHz(frac, nyquist, scale) {
    const minHz = 20;
    switch (scale) {
        case "MEL":
            return melToHz(hzToMel(minHz) + frac * (hzToMel(nyquist) - hzToMel(minHz)));
        case "LOG":
            return Math.pow(10, Math.log10(minHz) + frac * (Math.log10(nyquist) - Math.log10(minHz)));
        case "OCTAVE":
            return Math.pow(2, Math.log2(minHz) + frac * (Math.log2(nyquist) - Math.log2(minHz)));
        case "LINEAR":
        default:
            return frac * nyquist;
    }
}

function buildScaleMap(numBins, numPx, sampleRate, scale) {
    const map = new Float32Array(numPx);
    const nyquist = sampleRate / 2;
    for (let px = 0; px < numPx; px++) {
        const hz = scaleToHz(px / (numPx - 1), nyquist, scale);
        map[px] = (hz / nyquist) * (numBins - 1);
    }
    return map;
}

function remapBins(srcBuf, dstBuf, scaleMap) {
    for (let px = 0; px < scaleMap.length; px++) {
        const binF = scaleMap[px];
        const lo = Math.floor(binF);
        const hi = Math.min(lo + 1, srcBuf.length - 1);
        const t = binF - lo;
        dstBuf[px] = srcBuf[lo] * (1 - t) + srcBuf[hi] * t;
    }
}

function hzToNoteString(hz) {
    if (hz <= 0 || !isFinite(hz)) return "";
    const A4 = 440;
    const noteNames = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
    // 69 is midi note for A4
    const midiNum = Math.round(12 * Math.log2(hz / A4) + 69);
    if (midiNum < 0 || midiNum > 127) return `${hz.toFixed(1)} Hz`;
    const octave = Math.floor(midiNum / 12) - 1;
    const noteName = noteNames[midiNum % 12];
    return `${noteName}${octave} (${hz.toFixed(1)} Hz)`;
}

