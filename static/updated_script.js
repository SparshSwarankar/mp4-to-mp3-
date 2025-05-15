// ...your JS code...
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
    const newConversionBtn = document.getElementById('newConversionBtn');
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

    // === Variables ===
    let selectedFiles = [];
    let convertedFiles = [];
    let conversionType = 'normal';
    let isBatchMode = false;
    let audioContext, analyser, dataArray;
    let canvasCtx = audioVisualizer ? audioVisualizer.getContext('2d') : null;

    // === Theme Initialization (WORKS ON ALL PAGES) ===
    if (themeToggle) {
        let savedTheme = localStorage.getItem('theme');
        if (!savedTheme) {
            savedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        // Always set the theme on page load
        document.documentElement.setAttribute('data-theme', savedTheme);
        themeToggle.checked = savedTheme === 'dark';
        themeToggle.setAttribute('aria-checked', themeToggle.checked ? 'true' : 'false');

        // Remove any previous event listeners
        themeToggle.onchange = null;
        themeToggle.oninput = null;

        // Use 'change' event for best reliability
        themeToggle.addEventListener('change', function() {
            const theme = this.checked ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
            // Fix: aria-checked must be a string "true"/"false"
            themeToggle.setAttribute('aria-checked', this.checked ? 'true' : 'false');
        });

        // Listen for system theme changes only if user hasn't set a preference
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            if (!localStorage.getItem('theme')) {
                const theme = e.matches ? 'dark' : 'light';
                document.documentElement.setAttribute('data-theme', theme);
                themeToggle.checked = theme === 'dark';
                themeToggle.setAttribute('aria-checked', themeToggle.checked ? 'true' : 'false');
            }
        });
    }

    // === Theme Toggle and Batch Toggle Label Highlight ===
    (function() {
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
            themeToggle.addEventListener('change', function() {
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
            const files = e.dataTransfer.files;
            isBatchMode ? processMultipleFiles(files) : processFile(files[0]);
        });

        dropZone.addEventListener('click', (e) => {
            if (e.target === dropZone && fileInput) {
                fileInput.value = '';
                fileInput.click();
            }
        });
    }

    if (fileInput) {
        fileInput.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        fileInput.addEventListener('change', e => {
            const files = e.target.files;
            isBatchMode ? processMultipleFiles(files) : processFile(files[0]);
        });
    }

    if (convertBtn) convertBtn.addEventListener('click', handleConversion);
    if (downloadBtn) downloadBtn.addEventListener('click', downloadFile);
    if (downloadAllBtn) downloadAllBtn.addEventListener('click', downloadAllFiles);
    if (audioPreview) audioPreview.addEventListener('play', setupAudioVisualization);
    if (newConversionBtn) newConversionBtn.addEventListener('click', resetConverter);

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
        if (file.type !== 'video/mp4') {
            if (showAlert) showCustomErrorModal('file', 'Only MP4 files are allowed.');
            return false;
        }
        if (file.size > 500 * 1024 * 1024) {
            if (showAlert) showCustomErrorModal('file', 'File exceeds 500MB limit.');
            return false;
        }
        return true;
    }

    function resetConverter() {
        selectedFiles = [];
        convertedFiles = [];
        fileInput.value = '';
        fileList.innerHTML = '';
        fileInfo.textContent = 'Maximum file size: 500MB';
        fileInfo.style.color = 'var(--text-secondary)';
        progressContainer.style.display = 'none';
        progressBar.style.width = '0%';
        progressText.textContent = '0%';
        resultSection.style.display = 'none';
        convertBtn.disabled = true;
        convertBtn.textContent = 'Convert';
        audioPreview.pause();
        audioPreview.src = '';
        batchDownloadList.innerHTML = '';
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
        fileInfo.textContent = `Selected: ${file.name} (${formatFileSize(file.size)})`;
        fileInfo.style.color = 'var(--text-secondary)';
        convertBtn.disabled = false;
    }

    function processMultipleFiles(files) {
        // Convert FileList to Array and merge with existing selectedFiles, avoiding duplicates
        const newFiles = Array.from(files);
        // Only add files that are not already in selectedFiles (by name and size)
        newFiles.forEach(file => {
            if (
                !selectedFiles.some(
                    f => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified
                )
            ) {
                selectedFiles.push(file);
            }
        });

        let skipped = 0;
        // Remove invalid files from selectedFiles
        selectedFiles = selectedFiles.filter(file => {
            const valid = validateFile(file, false);
            if (!valid) skipped++;
            return valid;
        });

        updateFileList();
        convertBtn.disabled = selectedFiles.length === 0;
        fileInfo.textContent = skipped
            ? `Some files skipped. ${selectedFiles.length} valid file(s) selected.`
            : `${selectedFiles.length} file(s) selected.`;
        fileInfo.style.color = skipped ? 'red' : 'var(--text-secondary)';
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

    async function handleConversion() {
        if (!selectedFiles.length) return;

        function setStatus(msg, color = null) {
            if (conversionStatus) {
                conversionStatus.textContent = msg;
                conversionStatus.style.color = color || "var(--primary-color)";
            }
        }

        convertBtn.disabled = true;
        convertBtn.textContent = 'Converting...';
        if (progressContainer) progressContainer.style.display = 'block';
        if (progressBar) progressBar.style.width = '0%';
        if (progressText) progressText.textContent = '0%';
        convertedFiles = [];

        // === Backend URL selection logic ===
        const RENDER_BACKEND_URL = 'https://YOUR-RENDER-BACKEND-URL.onrender.com/convert';
        const LOCAL_BACKEND_URL = 'http://127.0.0.1:5000/convert';

        function getBackendUrl() {
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                return LOCAL_BACKEND_URL;
            }
            return RENDER_BACKEND_URL;
        }

        // --- Batch mode: send all files in one request ---
        if (isBatchMode && selectedFiles.length > 1) {
            setStatus(`Uploading and converting ${selectedFiles.length} files...`);
            if (progressBar) progressBar.style.width = '10%';
            if (progressText) progressText.textContent = '10%';

            const formData = new FormData();
            selectedFiles.forEach(file => formData.append('file', file));
            const backendUrl = getBackendUrl();

            let response;
            try {
                response = await fetch(backendUrl, {
                    method: 'POST',
                    body: formData
                });
            } catch (err) {
                showCustomErrorModal('network', 'Could not connect to backend. Is it running?');
                setStatus('Network error.', 'red');
                convertBtn.disabled = false;
                convertBtn.textContent = 'Convert Now';
                if (progressBar) progressBar.style.width = '0%';
                if (progressText) progressText.textContent = '0%';
                return;
            }

            if (progressBar) progressBar.style.width = '80%';
            if (progressText) progressText.textContent = '80%';

            if (!response.ok) {
                let msg = 'Conversion failed on server.';
                try {
                    const errJson = await response.json();
                    if (errJson && errJson.error) msg = errJson.error;
                } catch {}
                showCustomErrorModal('conversion', msg);
                setStatus('Conversion failed.', 'red');
                convertBtn.disabled = false;
                convertBtn.textContent = 'Convert Now';
                if (progressBar) progressBar.style.width = '0%';
                if (progressText) progressText.textContent = '0%';
                return;
            }

            // Expect a ZIP file
            let filename = 'converted_mp3s.zip';
            const disposition = response.headers.get('Content-Disposition');
            if (disposition && disposition.indexOf('filename=') !== -1) {
                const match = disposition.match(/filename="?([^"]+)"?/);
                if (match && match[1]) filename = match[1];
            }
            const blob = await response.blob();

            // Check for empty ZIP
            if (!blob || blob.size === 0) {
                showCustomErrorModal('conversion', 'No files were converted. Please check your input files.');
                setStatus('No files converted.', 'red');
                convertBtn.disabled = false;
                convertBtn.textContent = 'Convert Now';
                if (progressBar) progressBar.style.width = '0%';
                if (progressText) progressText.textContent = '0%';
                return;
            }

            const url = URL.createObjectURL(blob);
            convertedFiles = [{ url, filename }];

            if (progressBar) progressBar.style.width = '100%';
            if (progressText) progressText.textContent = '100%';

            setStatus('Batch conversion complete!', "var(--success-color)");
            showResult();
            return;
        }

        // --- Single file mode (or batch of 1) ---
        let fileIdx = 0;
        const totalFiles = selectedFiles.length;
        for (const file of selectedFiles) {
            setStatus(`Uploading and converting file ${fileIdx + 1} of ${totalFiles}...`);
            if (progressBar) progressBar.style.width = `${Math.round((fileIdx / totalFiles) * 100)}%`;
            if (progressText) progressText.textContent = `${Math.round((fileIdx / totalFiles) * 100)}%`;

            try {
                const formData = new FormData();
                formData.append('file', file);
                const backendUrl = getBackendUrl();

                let response;
                try {
                    response = await fetch(backendUrl, {
                        method: 'POST',
                        body: formData
                    });
                } catch (err) {
                    showCustomErrorModal('network', 'Could not connect to backend. Is it running?');
                    setStatus('Network error.', 'red');
                    convertBtn.disabled = false;
                    convertBtn.textContent = 'Convert Now';
                    if (progressBar) progressBar.style.width = '0%';
                    if (progressText) progressText.textContent = '0%';
                    return;
                }

                if (!response.ok) {
                    let msg = 'Conversion failed on server.';
                    try {
                        const errJson = await response.json();
                        if (errJson && errJson.error) msg = errJson.error;
                    } catch {}
                    showCustomErrorModal('conversion', msg);
                    setStatus('Conversion failed.', 'red');
                    convertBtn.disabled = false;
                    convertBtn.textContent = 'Convert Now';
                    if (progressBar) progressBar.style.width = '0%';
                    if (progressText) progressText.textContent = '0%';
                    return;
                }

                let filename = 'converted.mp3';
                const disposition = response.headers.get('Content-Disposition');
                if (disposition && disposition.indexOf('filename=') !== -1) {
                    const match = disposition.match(/filename="?([^"]+)"?/);
                    if (match && match[1]) filename = match[1];
                }
                const blob = await response.blob();
                if (!blob || blob.size === 0) {
                    showCustomErrorModal('conversion', 'No file was converted. Please check your input file.');
                    setStatus('No file converted.', 'red');
                    convertBtn.disabled = false;
                    convertBtn.textContent = 'Convert Now';
                    if (progressBar) progressBar.style.width = '0%';
                    if (progressText) progressText.textContent = '0%';
                    return;
                }
                const url = URL.createObjectURL(blob);
                convertedFiles.push({ url, filename });

                fileIdx++;
                if (progressBar) progressBar.style.width = `${Math.round((fileIdx / totalFiles) * 100)}%`;
                if (progressText) progressText.textContent = `${Math.round((fileIdx / totalFiles) * 100)}%`;

                setStatus(`File ${fileIdx} converted!`, "var(--success-color)");
            } catch (error) {
                setStatus("An error occurred during conversion.", "red");
                showCustomErrorModal('conversion', 'An error occurred during conversion.');
                convertBtn.disabled = false;
                convertBtn.textContent = 'Convert Now';
                if (progressBar) progressBar.style.width = '0%';
                if (progressText) progressText.textContent = '0%';
                return;
            }
        }
        showResult();
    }

    function showResult() {
        if (resultMessage) {
            resultMessage.textContent = 'Conversion completed successfully!';
            resultMessage.style.color = 'green';
        }
        if (resultSection) resultSection.style.display = 'block';
        if (batchDownloadList) batchDownloadList.innerHTML = '';

        // --- Batch mode ZIP download ---
        if (convertedFiles.length === 1 && isBatchMode && selectedFiles.length > 1) {
            audioPreview.src = '';
            audioPreview.style.display = 'none';

            // Show batch result section, hide single file result
            const batchFileResult = document.getElementById('batchFileResult');
            const singleFileResult = document.getElementById('singleFileResult');
            if (batchFileResult) batchFileResult.style.display = 'block';
            if (singleFileResult) singleFileResult.style.display = 'none';

            // Show Download All button for batch ZIP
            if (downloadAllBtn) {
                downloadAllBtn.style.display = 'inline-block';
                downloadAllBtn.disabled = false;
                // Remove any previous event listeners by replacing the node
                const newDownloadAllBtn = downloadAllBtn.cloneNode(true);
                downloadAllBtn.parentNode.replaceChild(newDownloadAllBtn, downloadAllBtn);
                newDownloadAllBtn.onclick = function () {
                    const fileObj = convertedFiles[0];
                    const a = document.createElement('a');
                    a.href = fileObj.url;
                    a.download = fileObj.filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(resetConverter, 500);
                };
            }

            // Remove ZIP download link in the batch list (no extra ZIP link)
            if (batchDownloadList) {
                batchDownloadList.innerHTML = '';
            }
            // Hide single download button
            if (downloadBtn) downloadBtn.style.display = 'none';

            // Prevent further code from running (which triggers extra downloads)
            return;
        }

        // --- Single file mode or batch of 1 ---
        if (convertedFiles.length === 1 && !isBatchMode) {
            const fileObj = convertedFiles[0];
            audioPreview.src = fileObj.url;
            audioPreview.load();
            audioPreview.style.display = 'block';

            if (downloadAllBtn) downloadAllBtn.style.display = 'none';
            if (downloadBtn) downloadBtn.style.display = 'inline-block';
            // Show single file result, hide batch result
            const batchFileResult = document.getElementById('batchFileResult');
            const singleFileResult = document.getElementById('singleFileResult');
            if (batchFileResult) batchFileResult.style.display = 'none';
            if (singleFileResult) singleFileResult.style.display = 'block';

            downloadBtn.replaceWith(downloadBtn.cloneNode(true));
            const newDownloadBtn = document.getElementById('downloadBtn');
            newDownloadBtn.onclick = function (e) {
                e.preventDefault();
                const a = document.createElement('a');
                a.href = fileObj.url;
                a.download = fileObj.filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(resetConverter, 500);
            };
        } else {
            audioPreview.src = '';
            audioPreview.style.display = 'none';
            downloadAllBtn.onclick = function () {
                convertedFiles.forEach((fileObj, idx) => {
                    const a = document.createElement('a');
                    a.href = fileObj.url;
                    a.download = fileObj.filename || `converted_${idx + 1}.mp3`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                });
                setTimeout(resetConverter, 500);
            };
            convertedFiles.forEach((fileObj, idx) => {
                const listItem = document.createElement('div');
                listItem.className = 'batch-item';
                listItem.innerHTML = `
                    <span>File ${idx + 1}</span>
                    <a href="${fileObj.url}" download="${fileObj.filename}" target="_blank">Download</a>
                `;
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
        // Fix: Prevent multiple MediaElementSourceNode connections
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        // Disconnect previous source if exists
        if (audioPreview._mediaSource) {
            try {
                audioPreview._mediaSource.disconnect();
            } catch (e) {}
            audioPreview._mediaSource = null;
        }

        // Only create a new source if not already connected
        if (!audioPreview._mediaSource) {
            try {
                analyser = audioContext.createAnalyser();
                analyser.fftSize = 256;
                dataArray = new Uint8Array(analyser.frequencyBinCount);

                audioPreview._mediaSource = audioContext.createMediaElementSource(audioPreview);
                audioPreview._mediaSource.connect(analyser);
                analyser.connect(audioContext.destination);
            } catch (e) {
                console.warn("Audio visualization setup failed:", e);
                return;
            }
        }

        drawVisualizer();
    }

    function drawVisualizer() {
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
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            var status = document.getElementById('contactStatus');
            status.textContent = "Sending...";
            status.style.color = "var(--primary-color)";
            setTimeout(function() {
                status.textContent = "Thank you for contacting us! We'll get back to you soon.";
                status.style.color = "var(--success-color)";
                contactForm.reset();
            }, 1200);
        });
    }

    // Example: If you ever set an image src in JS, do:
    // img.src = '/static/myimage.png';
});
