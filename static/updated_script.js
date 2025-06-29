document.addEventListener('DOMContentLoaded', function () {
    // === DOM Elements ===
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const fileInfo = document.getElementById('fileInfo');
    const fileList = document.getElementById('fileList');
    const uploadTitle = document.getElementById('uploadTitle');
    const convertBtn = document.getElementById('convertBtn');
    const resultSection = document.getElementById('resultSection');
    const resultMessage = document.getElementById('resultMessage');
    const audioPreview = document.getElementById('audioPreview');
    const downloadBtn = document.getElementById('downloadBtn');
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    const batchDownloadList = document.getElementById('batchDownloadList');
    const optionTabs = document.querySelectorAll('.option-tab');
    const normalOptions = document.getElementById('normalOptions');
    const themeToggle = document.getElementById('themeToggle');
    const batchToggle = document.getElementById('batchToggle');
    const singleFileResult = document.getElementById('singleFileResult');
    const batchFileResult = document.getElementById('batchFileResult');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const audioVisualizer = document.getElementById('audioVisualizer');
    const conversionStatus = document.getElementById('conversionStatus');

    // Audio Enhancer specific elements
    const enhanceBtn = document.getElementById('enhanceBtn');
    const bassTrebleSlider = document.getElementById('bassTreble');
    const bassTrebleValue = document.getElementById('bassTrebleValue');
    const progressStatus = document.getElementById('progressStatus'); // Added for audio progress
    const progressPercentage = document.getElementById('progressPercentage'); // Added for audio progress
    const currentFile = document.getElementById('currentFile'); // Added for audio progress
    const uploadSpeed = document.getElementById('uploadSpeed'); // Added for audio progress
    const uploadedSize = document.getElementById('uploadedSize'); // Added for audio progress
    const timeRemaining = document.getElementById('timeRemaining'); // Added for audio progress

    // === Variables ===
    let selectedFiles = [];
    let convertedFiles = [];
    let conversionType = 'normal';
    let isBatchMode = false;
    let audioContext, analyser, dataArray;
    let canvasCtx = audioVisualizer ? audioVisualizer.getContext('2d') : null;

    // Audio Enhancer specific state variables
    let selectedAudioFile = null; // For audio enhancement
    let enhancedAudioFile = null; // For audio enhancement
    let audioStartTime = 0; // For audio enhancement progress tracking

    // === Theme Initialization (WORKS ON ALL PAGES) ===
    function initializeTheme() {
        const themeToggle = document.getElementById('themeToggle');
        if (!themeToggle) return;

        // Get saved theme or system preference
        let savedTheme = localStorage.getItem('theme');
        if (!savedTheme) {
            savedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            localStorage.setItem('theme', savedTheme); // Save initial preference
        }

        // Apply theme immediately
        document.documentElement.setAttribute('data-theme', savedTheme);
        themeToggle.checked = savedTheme === 'dark';
        themeToggle.setAttribute('aria-checked', themeToggle.checked ? 'true' : 'false');

        // Theme toggle change handler
        themeToggle.addEventListener('change', function () {
            const theme = this.checked ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
            themeToggle.setAttribute('aria-checked', this.checked ? 'true' : 'false');
        });

        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            if (!localStorage.getItem('theme')) {
                const theme = e.matches ? 'dark' : 'light';
                document.documentElement.setAttribute('data-theme', theme);
                themeToggle.checked = theme === 'dark';
                themeToggle.setAttribute('aria-checked', themeToggle.checked ? 'true' : 'false');
            }
        });
    }

    // Initialize theme immediately
    initializeTheme();

    // === Theme Toggle and Batch Toggle Label Highlight ===
    (function () {
        // --- THEME TOGGLE LOGIC (robust for all pages) ---
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            const html = document.documentElement;
            // Always get the latest theme from localStorage or system
            let savedTheme = localStorage.getItem('theme');
            if (!savedTheme) {
                savedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            }
            // Set initial theme and checkbox state
            html.setAttribute('data-theme', savedTheme);
            themeToggle.checked = savedTheme === 'dark';
            themeToggle.setAttribute('aria-checked', themeToggle.checked);

            // Remove any previous event listeners
            themeToggle.onchange = null;
            themeToggle.oninput = null;

            // Use 'change' event for best reliability (not 'input')
            themeToggle.addEventListener('change', function () {
                const theme = this.checked ? 'dark' : 'light';
                html.setAttribute('data-theme', theme);
                localStorage.setItem('theme', theme);
                themeToggle.setAttribute('aria-checked', this.checked);
            });

            // Listen for system theme changes only if user hasn't set a preference
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
                if (!localStorage.getItem('theme')) {
                    const theme = e.matches ? 'dark' : 'light';
                    html.setAttribute('data-theme', theme);
                    themeToggle.checked = theme === 'dark';
                    themeToggle.setAttribute('aria-checked', themeToggle.checked);
                }
            });
        }

        // Batch toggle label highlight (only if present)
        const batchToggle = document.getElementById('batchToggle');
        const singleLabel = document.getElementById('singleLabel');
        const batchLabel = document.getElementById('batchLabel');
        if (batchToggle && singleLabel && batchLabel) {
            function updateBatchLabels() {
                if (batchToggle.checked) {
                    singleLabel.classList.remove('active');
                    batchLabel.classList.add('active');
                } else {
                    singleLabel.classList.add('active');
                    batchLabel.classList.remove('active');
                }
            }
            batchToggle.addEventListener('change', updateBatchLabels);
            updateBatchLabels();
        }
    })();

    // === Event Listeners ===

    // Only add event listeners if the elements exist
    if (dropZone) {
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
            // Distinguish between video and audio drop based on the page context
            if (window.location.pathname === '/audio-enhancer') {
                handleAudioFile(e.dataTransfer.files[0]);
            } else {
                isBatchMode ? processMultipleFiles(e.dataTransfer.files) : processFile(e.dataTransfer.files[0]);
            }
        });

        dropZone.addEventListener('click', (e) => {
            if (e.target === dropZone && fileInput) {
                fileInput.value = '';
                fileInput.click();
            }
        });
    }

    if (fileInput) {
        fileInput.addEventListener('click', (e) => e.stopPropagation());
        fileInput.addEventListener('change', e => {
            // Distinguish between video and audio file input based on the page context
            if (window.location.pathname === '/audio-enhancer') {
                handleAudioFile(e.target.files[0]);
            } else {
                isBatchMode ? processMultipleFiles(e.target.files) : processFile(e.target.files[0]);
            }
        });
    }

    if (convertBtn) convertBtn.addEventListener('click', handleConversion);
    if (downloadBtn) downloadBtn.addEventListener('click', downloadFile);
    if (downloadAllBtn) downloadAllBtn.addEventListener('click', downloadAllFiles);
    if (audioPreview) audioPreview.addEventListener('play', setupAudioVisualization);

    if (themeToggle) {
        themeToggle.addEventListener('change', function () {
            const theme = this.checked ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
        });
    }

    if (batchToggle) {
        batchToggle.addEventListener('change', function () {
            isBatchMode = this.checked;
            updateUploadArea();
        });
    }

    optionTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            optionTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            conversionType = tab.dataset.option;
            if (normalOptions) normalOptions.style.display = 'block';
        });
    });

    // Audio Enhancer specific event listeners
    if (enhanceBtn) enhanceBtn.addEventListener('click', handleAudioEnhancement);
    if (bassTrebleSlider) {
        bassTrebleSlider.addEventListener('input', updateBassTrebleSlider);
        // Initialize slider background on load if it exists
        updateBassTrebleSlider();
    }

    // === Custom Error Modals ===
    function showCustomErrorModal(type, message) {
        // Remove existing modal if present
        const existing = document.getElementById('customErrorModal');
        if (existing) existing.remove();

        // Icon and color based on error type
        let icon = '<i class="fas fa-exclamation-circle"></i>';
        let color = '#ff6b6b';
        let title = 'Error';

        if (type === 'network') {
            icon = '<i class="fas fa-wifi"></i>';
            color = '#ff9800';
            title = 'Network Error';
        } else if (type === 'file') {
            icon = '<i class="fas fa-file-alt"></i>';
            color = '#4a6cf7';
            title = 'File Error';
        } else if (type === 'conversion') {
            icon = '<i class="fas fa-sync-alt"></i>';
            color = '#ff6b6b';
            title = 'Conversion Error';
        } else if (type === 'timeout') {
            icon = '<i class="fas fa-clock"></i>';
            color = '#ff9800';
            title = 'Timeout';
        } else if (type === 'success') {
            icon = '<i class="fas fa-check-circle"></i>';
            color = '#4caf50';
            title = 'Success';
        }

        // Modal HTML
        const modal = document.createElement('div');
        modal.id = 'customErrorModal';
        modal.innerHTML = `
            <div class="custom-modal-overlay"></div>
            <div class="custom-modal-content" style="border-top: 6px solid ${color};">
                <div class="custom-modal-icon" style="color:${color};">${icon}</div>
                <div class="custom-modal-title">${title}</div>
                <div class="custom-modal-message">${message}</div>
                <button class="custom-modal-close">Close</button>
            </div>
        `;
        document.body.appendChild(modal);

        // Close logic
        modal.querySelector('.custom-modal-close').onclick = () => modal.remove();
        modal.querySelector('.custom-modal-overlay').onclick = () => modal.remove();
    }

    // === Functions ===

    function validateFile(file, showAlert = true) {
        // This function is for video conversion. A separate function `validateAudioFile` is for audio enhancement.
        // --- UPDATE: For audio trimmer, only allow MP3 files ---
        if (window.location.pathname === '/audio-trimmer') {
            if (file.type !== 'audio/mp3' && file.type !== 'audio/mpeg') {
                if (showAlert) {
                    showCustomErrorModal('file', 'Only MP3 files are allowed.');
                }
                return false;
            }
            if (file.size > 500 * 1024 * 1024) {
                if (showAlert) {
                    showCustomErrorModal('file', 'File exceeds 500MB limit.');
                }
                return false;
            }
            return true;
        }
        // ...existing logic for other tools...
        if (file.type !== 'video/mp4') {
            if (showAlert) {
                showCustomErrorModal('file', 'Only MP4 files are allowed.');
            }
            return false;
        
        }
        if (file.size > 200 * 1024 * 1024) {
            if (showAlert) {
                showCustomErrorModal('file', 'File exceeds 200MB limit.');
            }
            return false;
        }
        return true;
    }

    function resetConverter() {
        selectedFiles = [];
        convertedFiles = [];

        if (fileInput) fileInput.value = '';
        if (fileList) fileList.innerHTML = '';
        if (fileInfo) {
            fileInfo.textContent = 'Maximum file size: 500MB';
            fileInfo.style.color = 'var(--text-secondary)';
        }
        if (progressContainer) progressContainer.style.display = 'none';
        if (progressBar) progressBar.style.width = '0%';
        if (resultSection) resultSection.style.display = 'none';
        if (convertBtn) {
            convertBtn.disabled = true;
            convertBtn.textContent = 'Convert Now';
        }
        if (audioPreview) {
            audioPreview.pause();
            audioPreview.src = '';
        }
        if (batchDownloadList) batchDownloadList.innerHTML = '';

        // Reset progress indicators
        const elements = {
            'progressStatus': 'Preparing...',
            'progressPercentage': '0%',
            'currentFile': '-',
            'uploadSpeed': '0 KB/s',
            'uploadedSize': '0 KB',
            'timeRemaining': 'Calculating...'
        };

        for (const [id, value] of Object.entries(elements)) {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        }

        // Show upload area
        if (dropZone) dropZone.style.display = 'block';
    }

    function updateUploadArea() {
        uploadTitle.textContent = isBatchMode ? 'Drag & Drop your MP4 files here' : 'Drag & Drop your MP4 file here';
        if (isBatchMode) {
            fileInput.setAttribute('multiple', '');
            fileList.style.display = 'block';
        } else {
            fileInput.removeAttribute('multiple');
            fileList.style.display = 'none';
        }
        resetConverter();
    }

    function processFile(file) {
        if (!validateFile(file)) return;
        selectedFiles = [file];
        if (fileInfo) {
            fileInfo.textContent = `Selected: ${file.name} (${formatFileSize(file.size)})`;
            fileInfo.style.color = 'var(--text-secondary)';
        }
        if (convertBtn) convertBtn.disabled = false;
    }

    function processMultipleFiles(files) {
        const newFiles = Array.from(files);
        newFiles.forEach(file => {
            if (!selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
                selectedFiles.push(file);
            }
        });

        let skipped = 0;
        selectedFiles = selectedFiles.filter(file => {
            const valid = validateFile(file, false);
            if (!valid) skipped++;
            return valid;
        });

        updateFileList();
        if (convertBtn) convertBtn.disabled = selectedFiles.length === 0;
        if (fileInfo) {
            fileInfo.textContent = skipped
                ? `Some files skipped. ${selectedFiles.length} valid file(s) selected.`
                : `${selectedFiles.length} file(s) selected.`;
            fileInfo.style.color = skipped ? 'red' : 'var(--text-secondary)';
        }
    }

    function updateFileList() {
        fileList.innerHTML = '';
        selectedFiles.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'file-item';
            item.innerHTML = `
                <div class="file-name">${file.name}</div>
                <div class="file-size">${formatFileSize(file.size)}</div>
                <div class="file-remove"><i class="fas fa-times"></i></div>
            `;
            item.querySelector('.file-remove').addEventListener('click', () => {
                selectedFiles.splice(index, 1);
                updateFileList();
                convertBtn.disabled = selectedFiles.length === 0;
                // Update fileInfo to reflect new count after removal
                if (selectedFiles.length === 0) {
                    resetConverter();
                } else {
                    fileInfo.textContent = `${selectedFiles.length} file(s) selected.`;
                    fileInfo.style.color = 'var(--text-secondary)';
                }
            });
            fileList.appendChild(item);
        });
    }

    function formatFileSize(bytes) {
        if (bytes < 1024) return `${bytes} bytes`;
        if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1048576).toFixed(1)} MB`;
    }

    // === Utility: Upload File With Progress (make available globally) ===
    function uploadFileWithProgress(file, url, formDataOverride = null, isAudioEnhance = false) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const formData = formDataOverride || new FormData();
            if (!formDataOverride) formData.append('file', file);

            // Progress tracking variables
            let startTime = Date.now();
            let lastLoaded = 0;
            let lastTime = startTime;

            xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable) {
                    const currentTime = Date.now();
                    const timeDiff = (currentTime - lastTime) / 1000; // seconds
                    const loadedDiff = event.loaded - lastLoaded;
                    const currentSpeed = (loadedDiff / 1024) / timeDiff; // KB/s

                    // Calculate progress percentage
                    const progress = (event.loaded / event.total) * 100;
                    if (progressBar) progressBar.style.width = `${progress}%`;
                    if (progressPercentage) progressPercentage.textContent = `${Math.round(progress)}%`;

                    // Update current file info
                    if (currentFile) currentFile.textContent = file.name;

                    // Update speed
                    if (uploadSpeed) uploadSpeed.textContent = `${Math.round(currentSpeed)} KB/s`;

                    // Update uploaded size
                    if (uploadedSize) uploadedSize.textContent = `${Math.round(event.loaded / 1024)} KB`;

                    // Calculate time remaining
                    if (currentSpeed > 0 && timeRemaining) {
                        const remainingBytes = event.total - event.loaded;
                        const remainingSeconds = (remainingBytes / 1024) / currentSpeed;
                        timeRemaining.textContent = remainingSeconds > 60
                            ? `${Math.round(remainingSeconds / 60)}m ${Math.round(remainingSeconds % 60)}s`
                            : `${Math.round(remainingSeconds)}s`;
                    }

                    // Update for next calculation
                    lastLoaded = event.loaded;
                    lastTime = currentTime;

                    if (progressStatus) progressStatus.textContent = `Uploading ${file.name}...`;
                }
            });

            xhr.addEventListener('load', () => {
                if (xhr.status === 200) {
                    // Parse headers manually
                    const headers = {};
                    xhr.getAllResponseHeaders().trim().split(/[\r\n]+/).forEach(line => {
                        const parts = line.split(': ');
                        const key = parts.shift();
                        const value = parts.join(': ');
                        headers[key.toLowerCase()] = value;
                    });
                    resolve({
                        ok: true,
                        blob: () => Promise.resolve(xhr.response),
                        headers: {
                            get: (name) => headers[name.toLowerCase()]
                        }
                    });
                } else {
                    reject(new Error(`HTTP Error: ${xhr.status}`));
                }
            });

            xhr.addEventListener('error', () => {
                reject(new Error('Network error occurred'));
            });

            xhr.addEventListener('abort', () => {
                reject(new Error('Upload aborted'));
            });

            xhr.open('POST', url);
            xhr.responseType = 'blob';
            xhr.send(formData);
        });
    }

    async function handleConversion() {
        if (!selectedFiles.length) {
            showCustomErrorModal('file', 'Please select at least one file to convert.');
            return;
        }

        // Progress tracking elements
        const progressStatus = document.getElementById('progressStatus');
        const progressPercentage = document.getElementById('progressPercentage');
        const currentFile = document.getElementById('currentFile');
        const uploadSpeed = document.getElementById('uploadSpeed');
        const uploadedSize = document.getElementById('uploadedSize');
        const timeRemaining = document.getElementById('timeRemaining');
        const progressBar = document.getElementById('progressBar');

        // Reset progress display
        progressContainer.style.display = 'block';
        progressBar.style.width = '0%';
        progressStatus.textContent = 'Preparing...';
        progressPercentage.textContent = '0%';
        currentFile.textContent = '-';
        uploadSpeed.textContent = '0 KB/s';
        uploadedSize.textContent = '0 KB';
        timeRemaining.textContent = 'Calculating...';

        convertedFiles = [];

        const RENDER_BACKEND_URL = 'https://sound-shift.onrender.com/convert';
        const LOCAL_BACKEND_URL = 'http://127.0.0.1:5000/convert';
        const backendUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? LOCAL_BACKEND_URL : RENDER_BACKEND_URL;

        // Batch mode handling
        if (isBatchMode && selectedFiles.length > 1) {
            const formData = new FormData();
            let totalSize = 0;
            selectedFiles.forEach(file => {
                formData.append('file', file);
                totalSize += file.size;
            });

            try {
                progressStatus.textContent = 'Preparing batch upload...';
                const response = await uploadFileWithProgress(selectedFiles[0], backendUrl);

                if (!response.ok) throw new Error('Conversion failed');

                const blob = await response.blob();
                if (!blob || blob.size === 0) throw new Error('Empty response');

                const filename = response.headers.get('Content-Disposition')?.match(/filename="?([^"]+)"?/)?.[1] || 'converted_mp3s.zip';
                const url = URL.createObjectURL(blob);
                convertedFiles = [{ url, filename }];

                progressStatus.textContent = 'Batch conversion complete!';
                progressBar.style.width = '100%';
                progressPercentage.textContent = '100%';
                showResult();

            } catch (error) {
                showCustomErrorModal('conversion', error.message || 'Conversion failed. Please try again.');
                resetProgress();
            }
            return;
        }

        // Single file mode
        for (const file of selectedFiles) {
            try {
                progressStatus.textContent = `Processing ${file.name}...`;
                const response = await uploadFileWithProgress(file, backendUrl);

                if (!response.ok) throw new Error('Conversion failed');

                progressStatus.textContent = `Converting ${file.name}...`;
                const blob = await response.blob();
                if (!blob || blob.size === 0) throw new Error('Empty response');

                const filename = response.headers.get('content-disposition')?.match(/filename="?([^"]+)"?/)?.[1] || 'converted.mp3';
                const url = URL.createObjectURL(blob);
                convertedFiles.push({ url, filename });

                progressStatus.textContent = `${file.name} converted successfully!`;
                progressBar.style.width = '100%';
                progressPercentage.textContent = '100%';

            } catch (error) {
                showCustomErrorModal('conversion', error.message || 'Conversion failed. Please try again.');
                resetProgress();
                return;
            }
        }

        progressStatus.textContent = 'All conversions complete!';
        showResult();
    }

    function resetProgress() {
        convertBtn.disabled = false;
        convertBtn.textContent = 'Convert Now';
        progressBar.style.width = '0%';
        progressContainer.style.display = 'none';
        document.getElementById('progressStatus').textContent = 'Preparing...';
        document.getElementById('progressPercentage').textContent = '0%';
        document.getElementById('currentFile').textContent = '-';
        document.getElementById('uploadSpeed').textContent = '0 KB/s';
        document.getElementById('uploadedSize').textContent = '0 KB';
        document.getElementById('timeRemaining').textContent = 'Calculating...';
    }

    async function deleteConvertedFile(filename) {
        try {
            const response = await fetch(`${backendUrl}/delete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ filename: filename })
            });

            if (!response.ok) {
                console.warn('File deletion failed:', filename);
            }
        } catch (error) {
            console.warn('Error during file deletion:', error);
        }
    }

    // --- Download logic: only trigger one download per tool ---
    function downloadEnhancedFile() {
        if (!enhancedAudioFile) return;
        const a = document.createElement('a');
        a.href = enhancedAudioFile.url;
        a.download = enhancedAudioFile.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    // Attach download event only once, and always overwrite previous handlers
    function setDownloadBtnHandler() {
        if (!downloadBtn) return;
        // Remove all previous event listeners by replacing the node
        const newDownloadBtn = downloadBtn.cloneNode(true);
        downloadBtn.parentNode.replaceChild(newDownloadBtn, downloadBtn);

        newDownloadBtn.onclick = function (e) {
            e.preventDefault();
            if (isAudioEnhancerPage() && enhancedAudioFile) {
                downloadEnhancedFile();
            } else if (convertedFiles.length > 0) {
                // MP4 to MP3 tool
                const fileObj = convertedFiles[0];
                const a = document.createElement('a');
                a.href = fileObj.url;
                a.download = fileObj.filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
        };
    }

    // --- Audio preview logic for enhancer: REMOVE preview and visualizer ---
    function showAudioResult() {
        if (resultSection) resultSection.style.display = 'block';
        setDownloadBtnHandler();
    }

    // --- Audio preview logic for converter: KEEP preview ---
    function showResult() {
        if (resultMessage) {
            resultMessage.textContent = 'Conversion completed successfully!';
            resultMessage.style.color = 'green';
        }
        if (resultSection) resultSection.style.display = 'block';

        // --- Batch mode ZIP download ---
        if (convertedFiles.length === 1 && isBatchMode && selectedFiles.length > 1) {
            audioPreview.src = '';
            audioPreview.style.display = 'none';

            const batchFileResult = document.getElementById('batchFileResult');
            const singleFileResult = document.getElementById('singleFileResult');
            if (batchFileResult) batchFileResult.style.display = 'block';
            if (singleFileResult) singleFileResult.style.display = 'none';

            if (downloadAllBtn) {
                downloadAllBtn.style.display = 'inline-block';
                downloadAllBtn.disabled = false;
                const newDownloadAllBtn = downloadAllBtn.cloneNode(true);
                downloadAllBtn.parentNode.replaceChild(newDownloadAllBtn, downloadAllBtn);
                newDownloadAllBtn.onclick = async function () {
                    const fileObj = convertedFiles[0];
                    const a = document.createElement('a');
                    a.href = fileObj.url;
                    a.download = fileObj.filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);

                    // Delete the ZIP file after download
                    await deleteConvertedFile(fileObj.filename);

                    // Clean up the URL object
                    URL.revokeObjectURL(fileObj.url);

                    // Reset the converter after a short delay
                    setTimeout(resetConverter, 500);
                };
            }

            if (batchDownloadList) batchDownloadList.innerHTML = '';
            if (downloadBtn) downloadBtn.style.display = 'none';
            return;
        }

        // --- Single file mode or batch of 1 ---
        if (convertedFiles.length === 1 && !isBatchMode) {
            const fileObj = convertedFiles[0];
            audioPreview.src = fileObj.url;
            audioPreview.load();
            audioPreview.style.display = 'block';
            setupAudioVisualization();
            if (downloadAllBtn) downloadAllBtn.style.display = 'none';
            if (downloadBtn) downloadBtn.style.display = 'inline-block';

            const batchFileResult = document.getElementById('batchFileResult');
            const singleFileResult = document.getElementById('singleFileResult');
            if (batchFileResult) batchFileResult.style.display = 'none';
            if (singleFileResult) singleFileResult.style.display = 'block';

            downloadBtn.replaceWith(downloadBtn.cloneNode(true));
            const newDownloadBtn = document.getElementById('downloadBtn');
            newDownloadBtn.onclick = async function (e) {
                e.preventDefault();
                const a = document.createElement('a');
                a.href = fileObj.url;
                a.download = fileObj.filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                // Delete the file after download
                await deleteConvertedFile(fileObj.filename);

                // Clean up the URL object
                URL.revokeObjectURL(fileObj.url);

                // Reset the converter after a short delay
                setTimeout(resetConverter, 500);
            };
        } else {
            audioPreview.src = '';
            audioPreview.style.display = 'none';
            downloadAllBtn.onclick = async function () {
                for (const fileObj of convertedFiles) {
                    const a = document.createElement('a');
                    a.href = fileObj.url;
                    a.download = fileObj.filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);

                    // Delete each file after download
                    await deleteConvertedFile(fileObj.filename);

                    // Clean up the URL object
                    URL.revokeObjectURL(fileObj.url);
                }
                // Reset the converter after all files are downloaded
                setTimeout(resetConverter, 500);
            };

            // Update batch download list with individual file downloads
            batchDownloadList.innerHTML = '';
            convertedFiles.forEach((fileObj, idx) => {
                const listItem = document.createElement('div');
                listItem.className = 'batch-item';
                listItem.innerHTML = `
                    <span>File ${idx + 1}</span>
                    <button class="batch-download-btn">Download</button>
                `;

                const downloadBtn = listItem.querySelector('.batch-download-btn');
                downloadBtn.onclick = async function () {
                    const a = document.createElement('a');
                    a.href = fileObj.url;
                    a.download = fileObj.filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);

                    // Delete the individual file after download
                    await deleteConvertedFile(fileObj.filename);

                    // Clean up the URL object
                    URL.revokeObjectURL(fileObj.url);

                    // Disable the button after download
                    this.disabled = true;
                    this.textContent = 'Downloaded';
                };

                batchDownloadList.appendChild(listItem);
            });
        }
    }

    function downloadFile() {
        const url = convertedFiles[0];
        const a = document.createElement('a');
        a.href = url;
        a.download = 'converted.mp3';
        a.click();
    }

    function downloadAllFiles() {
        convertedFiles.forEach((url, index) => {
            const a = document.createElement('a');
            a.href = url;
            a.download = `converted_${index + 1}.mp3`;
            a.click();
        });
    }

    function setupAudioVisualization() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        // Only create a MediaElementSource once per audio element
        if (!audioPreview._mediaSource) {
            try {
                audioPreview._mediaSource = audioContext.createMediaElementSource(audioPreview);
            } catch (e) {
                console.warn("Audio visualization setup failed:", e);
                return;
            }
        }

        // Always create a new analyser and connect it
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        dataArray = new Uint8Array(analyser.frequencyBinCount);

        // Disconnect previous connections if needed
        try {
            audioPreview._mediaSource.disconnect();
        } catch (e) { }

        audioPreview._mediaSource.connect(analyser);
        analyser.connect(audioContext.destination);

        drawVisualizer();
    }

    function drawVisualizer() {
        if (!audioVisualizer || !canvasCtx) return; // Prevent error if not present
        analyser.getByteFrequencyData(dataArray);
        canvasCtx.clearRect(0, 0, audioVisualizer.width, audioVisualizer.height);

        const barWidth = audioVisualizer.width / dataArray.length;
        let x = 0;

        dataArray.forEach(value => {
            const barHeight = value / 2;
            canvasCtx.fillStyle = 'rgba(0, 255, 0, 0.7)';
            canvasCtx.fillRect(x, audioVisualizer.height - barHeight, barWidth, barHeight);
            x += barWidth;
        });

        requestAnimationFrame(drawVisualizer);
    }

    // === Contact Form Handler (for contact.html) ===
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', function (e) {
            e.preventDefault();
            showCustomErrorModal('success', "Thank you for contacting us! We'll get back to you soon.");
            contactForm.reset();
        });
    }

    // Audio Enhancer specific functions
    function updateBassTrebleSlider() {
        if (!bassTrebleSlider || !bassTrebleValue) return;

        const value = bassTrebleSlider.value;
        const min = bassTrebleSlider.min;
        const max = bassTrebleSlider.max;
        const percentage = ((value - min) / (max - min)) * 100;

        bassTrebleValue.textContent = value;
        bassTrebleSlider.style.background = `linear-gradient(to right, var(--primary-color) ${percentage}%, var(--border-color) ${percentage}%)`;
    }

    function handleAudioFile(file) {
        if (!validateAudioFile(file)) return;

        selectedAudioFile = file;
        if (fileInfo) fileInfo.textContent = `Selected: ${file.name} (${formatFileSize(file.size)})`;
        if (fileInfo) fileInfo.style.color = 'var(--text-secondary)';
        if (enhanceBtn) enhanceBtn.disabled = false;
    }

    function validateAudioFile(file) {
        console.log("File type being validated:", file.type);
        const validTypes = ['audio/mp3', 'audio/wav', 'audio/mpeg'];
        if (!validTypes.includes(file.type)) {
            showCustomErrorModal('file', 'Only MP3 and WAV files are allowed.');
            return false;
        }
        if (file.size > 500 * 1024 * 1024) {
            showCustomErrorModal('file', 'File exceeds 500MB limit.');
            return false;
        }
        return true;
    }

    async function handleAudioEnhancement() {
        if (!selectedAudioFile) return;

        if (enhanceBtn) {
            enhanceBtn.disabled = true;
            enhanceBtn.textContent = 'Enhancing...';
        }
        if (progressContainer) progressContainer.style.display = 'block';
        if (progressBar) progressBar.style.width = '0%';
        audioStartTime = Date.now();

        const formData = new FormData();
        formData.append('file', selectedAudioFile);
        formData.append('volumeBoost', document.getElementById('volumeBoost').checked);
        formData.append('noiseReduction', document.getElementById('noiseReduction').checked);
        formData.append('bassTreble', bassTrebleSlider.value);

        try {
            const response = await uploadFileWithProgress(selectedAudioFile, '/enhance', formData, true);

            if (!response.ok) throw new Error('Enhancement failed');

            const blob = await response.blob();
            if (!blob || blob.size === 0) throw new Error('Empty response');

            const filename = response.headers.get('content-disposition')?.match(/filename="?([^"]+)"?/)?.[1] || 'enhanced_audio.mp3';
            enhancedAudioFile = { url: URL.createObjectURL(blob), filename };

            if (progressStatus) progressStatus.textContent = 'Enhancement complete!';
            if (progressBar) progressBar.style.width = '100%';
            if (progressPercentage) progressPercentage.textContent = '100%';

            showAudioResult();
        } catch (error) {
            showCustomErrorModal('enhancement', error.message || 'Enhancement failed. Please try again.');
            resetAudioProgress();
        }
    }

    // Helper to detect if we're on the audio enhancer page
    function isAudioEnhancerPage() {
        return window.location.pathname === '/audio-enhancer';
    }

    // Ensure the overall resetConverter also resets audio progress if applicable
    const originalResetConverter = resetConverter; // Save original for chaining
    resetConverter = function () {
        originalResetConverter();
        resetAudioProgress();
        // Additional resets if needed based on audio context
        if (audioPreview) audioPreview.src = '';
        if (resultSection) resultSection.style.display = 'none';
    };

    // Ensure that audio visualizer uses audioContext and analyser when playing audio
    // (This part is already in updated_script.js, ensure it works for audio as well)
    // if (audioPreview) audioPreview.addEventListener('play', setupAudioVisualization);

    // Modify downloadFile to handle both video and audio downloads
    const originalDownloadFile = downloadFile;
    downloadFile = function (e) {
        // Prevent double download on audio enhancer page
        if (window.location.pathname === '/audio-enhancer' && enhancedAudioFile) {
            if (e) e.preventDefault();
            downloadEnhancedFile();
            return false;
        } else {
            if (e) e.preventDefault();
            originalDownloadFile();
        }
    };

    // Popup functions
    function openPopup(popupId) {
        const popup = document.getElementById(popupId);
        if (popup) {
            popup.style.display = 'block';
            document.body.style.overflow = 'hidden';
        }
    }

    function closePopup(popupId) {
        const popup = document.getElementById(popupId);
        if (popup) {
            popup.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    }
});