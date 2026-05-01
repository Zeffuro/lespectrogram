// Audio file player: wraps the <audio> element, scrubber, and file-mode bar.
const FilePlayer = (() => {
    let audioEl = null;
    let droppedFile = null;
    let wired = false;

    function setBarVisible(visible) {
        const bar = document.getElementById("audioFileBar");
        if (bar) bar.classList.toggle("d-none", !visible);
    }

    function formatTime(s) {
        if (!s || isNaN(s)) return "0:00";
        const mins = Math.floor(s / 60);
        const secs = Math.floor(s % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    }

    function wireOnce(callbacks) {
        if (wired || !audioEl) return;
        wired = true;

        audioEl.addEventListener('play', () => callbacks.onPlay && callbacks.onPlay());
        audioEl.addEventListener('pause', () => callbacks.onPause && callbacks.onPause());
        audioEl.addEventListener('seeked', () => callbacks.onSeeked && callbacks.onSeeked());
        audioEl.addEventListener('ended', () => callbacks.onEnded && callbacks.onEnded());

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

    function load(file, callbacks) {
        droppedFile = file;
        document.getElementById("audioPlayerName").textContent = file.name;
        setBarVisible(true);

        if (!audioEl) audioEl = document.getElementById("audioPlayer");
        wireOnce(callbacks);

        audioEl.src = URL.createObjectURL(file);
    }

    function unload() {
        if (audioEl) {
            audioEl.pause();
            audioEl.src = "";
        }
        droppedFile = null;
        setBarVisible(false);
        const input = document.getElementById("audioFileInput");
        if (input) input.value = "";
    }

    function getElement() { return audioEl; }
    function hasFile() { return !!droppedFile; }

    return { load, unload, getElement, hasFile, setBarVisible };
})();

