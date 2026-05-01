// Persists user preferences in localStorage.
const Prefs = (() => {
    const KEY = "lespectrogram.prefs.v1";

    const DEFAULTS = {
        scaleType: "MEL",
        colorType: "JET",
        fftSize: 2048,
        smoothing: 0.8,
        autoFit: true,
        direction: "right", // Data entering from right (scrolls left) or left (scrolls right)
        showTooltip: true,  // Show Hz and exact Note on hover
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
    };

    let state = { ...DEFAULTS };
    const listeners = new Set();

    function load() {
        try {
            const raw = localStorage.getItem(KEY);
            if (raw) state = { ...DEFAULTS, ...JSON.parse(raw) };
        } catch (e) { /* ignore */ }
        return state;
    }

    function save() {
        try { localStorage.setItem(KEY, JSON.stringify(state)); }
        catch (e) { /* ignore quota / privacy errors */ }
    }

    function get(key) { return state[key]; }
    function getAll() { return { ...state }; }

    function set(key, value) {
        if (state[key] === value) return;
        state[key] = value;
        save();
        listeners.forEach(fn => { try { fn(key, value); } catch (e) {} });
    }

    function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

    function reset() {
        state = { ...DEFAULTS };
        save();
        listeners.forEach(fn => fn(null, null));
    }

    return { load, save, get, set, getAll, onChange, reset, DEFAULTS };
})();

