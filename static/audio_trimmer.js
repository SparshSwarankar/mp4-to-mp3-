document.addEventListener('DOMContentLoaded', function () {
    // === DOM Elements ===
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const fileInfo = document.getElementById('fileInfo');
    const fileList = document.getElementById('fileList');
    const audioPreview = document.getElementById('audioPreview');
    const trimBtn = document.getElementById('trimBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const startTimeInput = document.getElementById('startTime');
    const endTimeInput = document.getElementById('endTime');
    const rangeSlider = document.getElementById('rangeSlider');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const progressStatus = document.getElementById('progressStatus');
    const progressPercentage = document.getElementById('progressPercentage');
    const resultSection = document.getElementById('resultSection');
    const resultMessage = document.getElementById('resultMessage');
    const singleFileResult = document.getElementById('singleFileResult');
    // === Extra DOM for theme toggle (for consistency) ===
    const themeToggle = document.getElementById('themeToggle');

    // === Theme Initialization (WORKS ON ALL PAGES) ===
    function initializeTheme() {
        if (!themeToggle) return;
        let savedTheme = localStorage.getItem('theme');
        if (!savedTheme) {
            savedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            localStorage.setItem('theme', savedTheme);
        }
        document.documentElement.setAttribute('data-theme', savedTheme);
        themeToggle.checked = savedTheme === 'dark';
        themeToggle.setAttribute('aria-checked', themeToggle.checked ? 'true' : 'false');
        themeToggle.addEventListener('change', function () {
            const theme = this.checked ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
            themeToggle.setAttribute('aria-checked', this.checked ? 'true' : 'false');
        });
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            if (!localStorage.getItem('theme')) {
                const theme = e.matches ? 'dark' : 'light';
                document.documentElement.setAttribute('data-theme', theme);
                themeToggle.checked = theme === 'dark';
                themeToggle.setAttribute('aria-checked', themeToggle.checked ? 'true' : 'false');
            }
        });
    }
    initializeTheme();

    let selectedFile = null;
    let trimmedBlobUrl = null;
    let audioDuration = 0;
    let activeTimeInput = 'start';

    function resetUI() {
        fileInfo.textContent = 'Maximum file size: 500MB';
        fileInfo.style.color = 'var(--text-secondary)';
        fileList.innerHTML = '';
        audioPreview.src = '';
        trimBtn.disabled = true;
        downloadBtn.style.display = 'none';
        startTimeInput.value = 0;
        endTimeInput.value = 0;
        rangeSlider.value = 0;
        rangeSlider.max = 100;
        audioDuration = 0;
        trimmedBlobUrl && URL.revokeObjectURL(trimmedBlobUrl);
        trimmedBlobUrl = null;
        if (resultSection) resultSection.style.display = 'none';
        if (singleFileResult) singleFileResult.style.display = 'none';
    }

    function handleFile(file) {
        if (!file) return;
        // Only allow audio files (MP3 and WAV)
        const validTypes = ['audio/mp3', 'audio/mpeg', 'audio/wav'];
        const validExtensions = ['.mp3', '.wav'];
        const fileName = file.name ? file.name.toLowerCase() : '';
        const hasValidExt = validExtensions.some(ext => fileName.endsWith(ext));
        if (!validTypes.includes(file.type) && !hasValidExt) {
            fileInfo.textContent = 'Only MP3 and WAV audio files are allowed.';
            fileInfo.style.color = 'red';
            return;
        }
        if (file.size > 500 * 1024 * 1024) {
            fileInfo.textContent = 'File exceeds 500MB limit.';
            fileInfo.style.color = 'red';
            return;
        }
        selectedFile = file;
        fileInfo.textContent = `Selected: ${file.name} (${(file.size / 1048576).toFixed(1)} MB)`;
        fileInfo.style.color = 'var(--text-secondary)';
        fileList.innerHTML = '';
        trimBtn.disabled = false;
        const url = URL.createObjectURL(file);
        audioPreview.src = url;
        audioPreview.load();
        audioPreview.onloadedmetadata = function () {
            audioDuration = audioPreview.duration;
            startTimeInput.value = 0;
            endTimeInput.value = audioDuration.toFixed(2);
            startTimeInput.max = audioDuration;
            endTimeInput.max = audioDuration;
            rangeSlider.min = 0;
            rangeSlider.max = audioDuration;
            rangeSlider.value = 0;
        };
    }

    // Drag & Drop
    dropZone.addEventListener('dragover', e => {
        e.preventDefault();
        dropZone.classList.add('active');
    });
    dropZone.addEventListener('dragleave', e => {
        e.preventDefault();
        dropZone.classList.remove('active');
    });
    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('active');
        handleFile(e.dataTransfer.files[0]);
    });
    dropZone.addEventListener('click', (e) => {
        if (e.target === dropZone && fileInput) {
            fileInput.value = '';
            fileInput.click();
        }
    });

    fileInput.addEventListener('click', (e) => e.stopPropagation());
    fileInput.addEventListener('change', e => {
        handleFile(e.target.files[0]);
    });

    // Track which input is focused
    startTimeInput.addEventListener('focus', function () {
        activeTimeInput = 'start';
        rangeSlider.value = startTimeInput.value;
    });
    endTimeInput.addEventListener('focus', function () {
        activeTimeInput = 'end';
        rangeSlider.value = endTimeInput.value;
    });

    // Prevent number key input for start/end time fields, but allow arrow keys for navigation and do NOT clear value
    function blockNumberInput(e) {
        // Allow: Arrow keys, Tab, Backspace, Delete, Home, End, Shift, Control, Alt, etc.
        if (
            e.key === "ArrowLeft" || e.key === "ArrowRight" ||
            e.key === "ArrowUp" || e.key === "ArrowDown" ||
            e.key === "Tab" || e.key === "Backspace" || e.key === "Delete" ||
            e.key === "Home" || e.key === "End" ||
            e.ctrlKey || e.altKey || e.metaKey || e.shiftKey
        ) {
            return;
        }
        // Block: 0-9, ., -, and all other keys
        e.preventDefault();
        // Optional: flash border for feedback
        e.target.style.borderColor = 'red';
        setTimeout(() => { e.target.style.borderColor = ''; }, 300);
    }
    startTimeInput.addEventListener('keydown', blockNumberInput);
    endTimeInput.addEventListener('keydown', blockNumberInput);

    // Also block paste events
    startTimeInput.addEventListener('paste', function (e) { e.preventDefault(); });
    endTimeInput.addEventListener('paste', function (e) { e.preventDefault(); });

    // Range slider sync (only way to set time)
    rangeSlider.addEventListener('input', function () {
        const val = parseFloat(rangeSlider.value);
        if (activeTimeInput === 'start') {
            let maxStart = Math.max(0, parseFloat(endTimeInput.value) - 0.1);
            let newStart = Math.min(val, maxStart);
            startTimeInput.value = newStart.toFixed(2);
            audioPreview.currentTime = newStart;
            if (parseFloat(endTimeInput.value) <= newStart) {
                let nextEnd = Math.min(newStart + 0.1, audioDuration);
                endTimeInput.value = nextEnd.toFixed(2);
            }
        } else if (activeTimeInput === 'end') {
            let minEnd = Math.min(audioDuration, Math.max(parseFloat(startTimeInput.value) + 0.1, val));
            endTimeInput.value = minEnd.toFixed(2);
        }
    });

    // Preview only trimmed section
    audioPreview.addEventListener('timeupdate', function () {
        if (audioPreview.currentTime > parseFloat(endTimeInput.value)) {
            audioPreview.pause();
        }
    });

    function showResult() {
        if (resultMessage) {
            resultMessage.textContent = 'Your trimmed audio file is ready to download';
            resultMessage.style.color = 'green';
        }
        if (resultSection) resultSection.style.display = 'block';
        if (singleFileResult) singleFileResult.style.display = 'block';
        if (downloadBtn) downloadBtn.style.display = 'inline-block';
        if (document.getElementById('batchFileResult')) document.getElementById('batchFileResult').style.display = 'none';
    }

    // Trim button
    trimBtn.addEventListener('click', async function () {
        if (!selectedFile) return;
        trimBtn.disabled = true;
        progressContainer.style.display = 'block';
        progressBar.style.width = '0%';
        progressStatus.textContent = 'Uploading...';
        progressPercentage.textContent = '0%';

        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('start', startTimeInput.value);
        formData.append('end', endTimeInput.value);

        try {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/trim-audio', true);
            xhr.responseType = 'blob';

            let uploadDone = false;
            let startTime = Date.now();

            xhr.upload.onprogress = function (e) {
                if (e.lengthComputable) {
                    // Upload phase: 0% - 50%
                    const uploadPercent = Math.round((e.loaded / e.total) * 50);
                    progressBar.style.width = uploadPercent + '%';
                    progressPercentage.textContent = uploadPercent + '%';
                    progressStatus.textContent = 'Uploading...';
                }
            };
            xhr.onreadystatechange = function () {
                if (xhr.readyState === XMLHttpRequest.HEADERS_RECEIVED && !uploadDone) {
                    uploadDone = true;
                    // Upload phase is 50%, now conversion phase
                    progressBar.style.width = '50%';
                    progressPercentage.textContent = '50%';
                    progressStatus.textContent = 'Converting...';
                }
            };
            xhr.onload = function () {
                // Conversion phase: 50% - 100%
                progressBar.style.width = '100%';
                progressPercentage.textContent = '100%';
                if (xhr.status === 200) {
                    progressStatus.textContent = 'Trim complete!';
                    trimmedBlobUrl && URL.revokeObjectURL(trimmedBlobUrl);
                    trimmedBlobUrl = URL.createObjectURL(xhr.response);
                    audioPreview.src = trimmedBlobUrl;
                    audioPreview.load();
                    showResult();
                } else {
                    // Try to read the error message from the backend
                    const reader = new FileReader();
                    reader.onload = function() {
                        let errorMsg = 'Trim failed.';
                        try {
                            const json = JSON.parse(reader.result);
                            if (json && json.error) errorMsg = json.error;
                        } catch (e) {}
                        progressStatus.textContent = errorMsg;
                    };
                    reader.readAsText(xhr.response);
                    progressBar.style.width = '0%';
                    progressPercentage.textContent = '0%';
                }
                trimBtn.disabled = false;
            };
            xhr.onerror = function () {
                progressStatus.textContent = 'Network error.';
                trimBtn.disabled = false;
            };
            xhr.send(formData);
        } catch (err) {
            progressStatus.textContent = 'Error: ' + err.message;
            trimBtn.disabled = false;
        }
    });

    // Download trimmed audio
    downloadBtn.addEventListener('click', function () {
        if (!trimmedBlobUrl) return;
        const a = document.createElement('a');
        a.href = trimmedBlobUrl;
        a.download = 'trimmed_audio.mp3';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });

    // Reset UI on load
    resetUI();
});