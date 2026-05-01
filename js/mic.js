// Microphone permission hint banner.
const MIC_HINTS = {
    prompt:  { cls: "alert-info",    text: "This app needs microphone access to visualize your voice. Click <strong>Start</strong> to begin." },
    waiting: { cls: "alert-warning", text: "Look for a popup at the <strong>top of your browser</strong> and click <strong>Allow</strong>." },
    denied:  { cls: "alert-danger",  text: "Microphone access was denied. Click the lock icon in your address bar, then <strong>Site settings</strong>, then allow <strong>Microphone</strong> and reload." },
    granted: null
};

function setMicHint(state) {
    const hint = document.getElementById("micHint");
    if (!hint) return;
    const info = MIC_HINTS[state];
    if (!info) { hint.style.display = "none"; return; }
    hint.className = `alert mt-2 text-center ${info.cls}`;
    hint.innerHTML = info.text;
    hint.style.display = "";
}

async function checkMicPermission() {
    try {
        const result = await navigator.permissions.query({ name: 'microphone' });
        setMicHint(result.state);
        result.addEventListener('change', () => setMicHint(result.state));
    } catch { setMicHint("prompt"); }
}

