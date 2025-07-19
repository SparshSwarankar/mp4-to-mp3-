// Audio Enhancer JavaScript for SoundShift

document.addEventListener('DOMContentLoaded', function () {
    // === DOM Elements ===
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const fileInfo = document.getElementById('fileInfo');
    const fileList = document.getElementById('fileList');
    const audioPreview = document.getElementById('audioPreview');
    const enhanceBtn = document.getElementById('enhanceBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const progressStatus = document.getElementById('progressStatus');
    const progressPercentage = document.getElementById('progressPercentage');
    const bassTrebleSlider = document.getElementById('bassTreble');
    const bassTrebleValue = document.getElementById('bassTrebleValue');
    const volumeBoost = document.getElementById('volumeBoost');
    const noiseReduction = document.getElementById('noiseReduction');
    const themeToggle = document.getElementById('themeToggle');
    const resultSection = document.getElementById('resultSection');
    const resultMessage = document.getElementById('resultMessage');
    const singleFileResult = document.getElementById('singleFileResult');

    // Defensive: check for audioPreview existence before using it
    function safeSetAudioSrc(src) {
        if (audioPreview) {
            audioPreview.src = src;
        }
    }
    function safeLoadAudio() {
        if (audioPreview) {
            audioPreview.load();
        }
    }

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
    let enhancedBlobUrl = null;
    let audioContext, analyser, dataArray;
    let canvasCtx = null;
    const audioVisualizer = document.getElementById('audioVisualizer');

    function resetUI() {
        fileInfo.textContent = 'Maximum file size: 500MB';
        fileInfo.style.color = 'var(--text-secondary)';
        fileList.innerHTML = '';
        safeSetAudioSrc('');
        enhanceBtn.disabled = true;
        downloadBtn.style.display = 'none';
        progressContainer.style.display = 'none';
        progressBar.style.width = '0%';
        progressStatus.textContent = 'Preparing...';
        progressPercentage.textContent = '0%';
        bassTrebleSlider.value = 0;
        bassTrebleValue.textContent = '0';
        volumeBoost.checked = false;
        noiseReduction.checked = false;
        enhancedBlobUrl && URL.revokeObjectURL(enhancedBlobUrl);
        enhancedBlobUrl = null;
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
        enhanceBtn.disabled = false;
        const url = URL.createObjectURL(file);
        safeSetAudioSrc(url);
        safeLoadAudio();
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

    // Bass/Treble slider UI
    bassTrebleSlider.addEventListener('input', function () {
        bassTrebleValue.textContent = bassTrebleSlider.value;
        bassTrebleSlider.style.background = `linear-gradient(to right, var(--primary-color) ${((bassTrebleSlider.value - bassTrebleSlider.min) / (bassTrebleSlider.max - bassTrebleSlider.min)) * 100}%, var(--border-color) ${((bassTrebleSlider.value - bassTrebleSlider.min) / (bassTrebleSlider.max - bassTrebleSlider.min)) * 100}%)`;
    });

    function showResult() {
        if (resultMessage) {
            resultMessage.textContent = 'Your enhanced audio file is ready to download';
            resultMessage.style.color = 'green';
        }
        if (resultSection) resultSection.style.display = 'block';
        if (singleFileResult) singleFileResult.style.display = 'block';
        if (downloadBtn) downloadBtn.style.display = 'inline-block';
        if (document.getElementById('batchFileResult')) document.getElementById('batchFileResult').style.display = 'none';
    }

    // Enhance button
    enhanceBtn.addEventListener('click', async function () {
        if (!selectedFile) return;
        enhanceBtn.disabled = true;
        enhanceBtn.textContent = 'Enhancing...';
        progressContainer.style.display = 'block';
        progressBar.style.width = '0%';
        progressStatus.textContent = 'Uploading...';
        progressPercentage.textContent = '0%';

        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('volumeBoost', volumeBoost.checked);
        formData.append('noiseReduction', noiseReduction.checked);
        formData.append('bassTreble', bassTrebleSlider.value);

        try {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/enhance', true);
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
                    progressStatus.textContent = 'Enhancing...';
                }
            };
            xhr.onload = function () {
                // Conversion phase: 50% - 100%
                progressBar.style.width = '100%';
                progressPercentage.textContent = '100%';
                if (xhr.status === 200) {
                    progressStatus.textContent = 'Enhancement complete!';
                    enhancedBlobUrl && URL.revokeObjectURL(enhancedBlobUrl);
                    enhancedBlobUrl = URL.createObjectURL(xhr.response);
                    safeSetAudioSrc(enhancedBlobUrl);
                    safeLoadAudio();
                    showResult();
                } else {
                    // Try to read the error message from the backend
                    const reader = new FileReader();
                    reader.onload = function () {
                        let errorMsg = 'Enhancement failed.';
                        try {
                            const json = JSON.parse(reader.result);
                            if (json && json.error) errorMsg = json.error;
                        } catch (e) { }
                        progressStatus.textContent = errorMsg;
                    };
                    reader.readAsText(xhr.response);
                    progressBar.style.width = '0%';
                    progressPercentage.textContent = '0%';
                }
                enhanceBtn.disabled = false;
                enhanceBtn.textContent = 'Enhance Audio';
            };
            xhr.onerror = function () {
                progressStatus.textContent = 'Network error.';
                enhanceBtn.disabled = false;
                enhanceBtn.textContent = 'Enhance Audio';
            };
            xhr.send(formData);
        } catch (err) {
            progressStatus.textContent = 'Error: ' + err.message;
            enhanceBtn.disabled = false;
            enhanceBtn.textContent = 'Enhance Audio';
        }
    });

    // Download enhanced audio
    downloadBtn.addEventListener('click', function () {
        if (!enhancedBlobUrl) return;
        const a = document.createElement('a');
        a.href = enhancedBlobUrl;
        a.download = 'enhanced_audio.mp3';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });

    // Reset UI on load
    resetUI();
});
