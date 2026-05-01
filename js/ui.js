// UI wiring for toolbar dropdowns, settings panel, and pref persistence.
function wireDropdown(attr, labelId, nameMap, setter) {
    const dataKey = attr.replace('data-', '');
    document.querySelectorAll(`[${attr}]`).forEach(el => {
        el.addEventListener('click', e => {
            e.preventDefault();
            const val = el.dataset[dataKey];
            setter(val);
            const labelEl = document.getElementById(labelId);
            if (labelEl) labelEl.textContent = nameMap[val] || val;
        });
    });
}

function setDropdownLabel(labelId, nameMap, value) {
    const el = document.getElementById(labelId);
    if (el) el.textContent = nameMap[value] || value;
}

const FFT_SIZES = [512, 1024, 2048, 4096, 8192, 16384, 32768];

function buildFftSizeMenu() {
    const menu = document.getElementById("fftSizeMenu");
    if (!menu) return;
    menu.innerHTML = "";
    for (const sz of FFT_SIZES) {
        const li = document.createElement("li");
        li.innerHTML = `<a class="dropdown-item" href="#" data-fftsize="${sz}">${sz} bins (${sz / 2} freq)</a>`;
        menu.appendChild(li);
    }
}

function wireSettingsPanel(onChange) {
    // FFT size
    buildFftSizeMenu();
    document.querySelectorAll("[data-fftsize]").forEach(el => {
        el.addEventListener('click', e => {
            e.preventDefault();
            const v = parseInt(el.dataset.fftsize, 10);
            Prefs.set("fftSize", v);
            document.getElementById("fftSizeLabel").textContent = `${v}`;
            onChange("fftSize", v);
        });
    });

    // Smoothing slider
    const smooth = document.getElementById("smoothingRange");
    const smoothVal = document.getElementById("smoothingVal");
    if (smooth) {
        smooth.addEventListener('input', () => {
            const v = parseFloat(smooth.value);
            smoothVal.textContent = v.toFixed(2);
            Prefs.set("smoothing", v);
            onChange("smoothing", v);
        });
    }

    // Audio constraint toggles
    const toggles = ["echoCancellation", "noiseSuppression", "autoGainControl"];
    toggles.forEach(name => {
        const el = document.getElementById(`opt_${name}`);
        if (!el) return;
        el.addEventListener('change', () => {
            Prefs.set(name, el.checked);
            onChange(name, el.checked);
        });
    });

    // Auto-fit toggle
    const autoFitEl = document.getElementById("opt_autoFit");
    if (autoFitEl) {
        autoFitEl.addEventListener('change', () => {
            Prefs.set("autoFit", autoFitEl.checked);
            onChange("autoFit", autoFitEl.checked);
        });
    }

    const tooltipEl = document.getElementById("opt_showTooltip");
    if (tooltipEl) {
        tooltipEl.addEventListener('change', () => {
            Prefs.set("showTooltip", tooltipEl.checked);
            onChange("showTooltip", tooltipEl.checked);
        });
    }

    document.querySelectorAll('input[name="opt_direction"]').forEach(el => {
        el.addEventListener('change', () => {
            if (el.checked) {
                Prefs.set("direction", el.value);
                onChange("direction", el.value);
            }
        });
    });

    // Reset button
    const resetEl = document.getElementById("prefsResetBtn");
    if (resetEl) {
        resetEl.addEventListener('click', e => {
            e.preventDefault();
            Prefs.reset();
            applyPrefsToUI();
            onChange(null, null);
        });
    }
}

function applyPrefsToUI() {
    const p = Prefs.getAll();
    setDropdownLabel("scaleLabel", SCALE_NAMES, p.scaleType);
    setDropdownLabel("colorLabel", COLOR_NAMES, p.colorType);

    const fftLbl = document.getElementById("fftSizeLabel");
    if (fftLbl) fftLbl.textContent = `${p.fftSize}`;

    const smooth = document.getElementById("smoothingRange");
    const smoothVal = document.getElementById("smoothingVal");
    if (smooth) { smooth.value = p.smoothing; }
    if (smoothVal) { smoothVal.textContent = Number(p.smoothing).toFixed(2); }

    ["echoCancellation", "noiseSuppression", "autoGainControl"].forEach(name => {
        const el = document.getElementById(`opt_${name}`);
        if (el) el.checked = !!p[name];
    });

    const autoFitEl = document.getElementById("opt_autoFit");
    if (autoFitEl) autoFitEl.checked = !!p.autoFit;

    const tooltipEl = document.getElementById("opt_showTooltip");
    if (tooltipEl) tooltipEl.checked = !!p.showTooltip;

    const dirEl = document.querySelector(`input[name="opt_direction"][value="${p.direction}"]`);
    if (dirEl) dirEl.checked = true;
}

