/**
 * OmniNotes AI - Application Frontend Logic (Notion Dark + Gemini Theme)
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // State
    const state = {
        sources: [],
        currentNote: null,
        selectedTemplate: 'notebooklm-master',
        activeSourceType: 'web',
        apiKey: localStorage.getItem('omninotes_gemini_key') || ''
    };

    const TEMPLATE_NAMES = {
        'notebooklm-master': 'NotebookLM Master Doc',
        'executive-briefing': 'Executive Briefing',
        'study-guide': 'Study Guide & Quiz',
        'mindmap-outline': 'Structured Mind Map',
        'audio-podcast-script': 'Podcast Script'
    };

    // DOM Elements
    const elements = {
        // Source Pills Nav
        sourcePills: document.querySelectorAll('.source-pill'),
        sourceInputPopover: document.getElementById('sourceInputPopover'),
        chipSourceToggle: document.getElementById('chipSourceToggle'),
        
        // Popover contents
        popWeb: document.getElementById('pop-web'),
        popYoutube: document.getElementById('pop-youtube'),
        popFile: document.getElementById('pop-file'),
        popText: document.getElementById('pop-text'),
        popWiki: document.getElementById('pop-wiki'),

        // Inputs
        webUrlInput: document.getElementById('webUrlInput'),
        btnAddWebUrl: document.getElementById('btnAddWebUrl'),
        
        ytUrlInput: document.getElementById('ytUrlInput'),
        btnAddYtUrl: document.getElementById('btnAddYtUrl'),
        
        fileDropzone: document.getElementById('fileDropzone'),
        fileInput: document.getElementById('fileInput'),
        
        rawTextInput: document.getElementById('rawTextInput'),
        btnAddRawText: document.getElementById('btnAddRawText'),
        
        wikiQueryInput: document.getElementById('wikiQueryInput'),
        btnAddWiki: document.getElementById('btnAddWiki'),
        
        // Prompt Bar & Templates
        customPromptInput: document.getElementById('customPromptInput'),
        btnGenerateNotes: document.getElementById('btnGenerateNotes'),
        chipTemplateBtn: document.getElementById('chipTemplateBtn'),
        chipTemplateLabel: document.getElementById('chipTemplateLabel'),
        templateCards: document.querySelectorAll('.template-card'),

        // Sources List
        sourcesList: document.getElementById('sourcesList'),
        sourceCountBadge: document.getElementById('sourceCountBadge'),
        btnClearAllSources: document.getElementById('btnClearAllSources'),

        // Canvas & Actions
        canvasTitleText: document.getElementById('canvasTitleText'),
        canvasActions: document.getElementById('canvasActions'),
        noteDisplayArea: document.getElementById('noteDisplayArea'),
        btnCopyForNotebookLM: document.getElementById('btnCopyForNotebookLM'),
        btnExportDropdown: document.getElementById('btnExportDropdown'),
        exportMenu: document.getElementById('exportMenu'),
        exportMd: document.getElementById('exportMd'),
        exportTxt: document.getElementById('exportTxt'),
        exportHtml: document.getElementById('exportHtml'),
        btnAudioPlayer: document.getElementById('btnAudioPlayer'),

        // Modals & Drawers
        apiKeyModal: document.getElementById('apiKeyModal'),
        btnOpenApiKeyModal: document.getElementById('btnOpenApiKeyModal'),
        btnCloseApiKeyModal: document.getElementById('btnCloseApiKeyModal'),
        modalApiKeyInput: document.getElementById('modalApiKeyInput'),
        btnSaveApiKey: document.getElementById('btnSaveApiKey'),
        btnRemoveApiKey: document.getElementById('btnRemoveApiKey'),
        apiKeyBadge: document.getElementById('apiKeyBadge'),

        bookmarkletModal: document.getElementById('bookmarkletModal'),
        btnBookmarkletModal: document.getElementById('btnBookmarkletModal'),
        btnCloseBookmarkletModal: document.getElementById('btnCloseBookmarkletModal'),
        btnCloseBookmarkletModal2: document.getElementById('btnCloseBookmarkletModal2'),
        bookmarkletLink: document.getElementById('bookmarkletLink'),

        historyDrawer: document.getElementById('historyDrawer'),
        btnMobileHistory: document.getElementById('btnMobileHistory'),
        btnMobileApiKey: document.getElementById('btnMobileApiKey'),
        btnCloseHistoryDrawer: document.getElementById('btnCloseHistoryDrawer'),
        historyList: document.getElementById('historyList'),

        toastContainer: document.getElementById('toastContainer')
    };

    init();

    function init() {
        setupEventListeners();
        updateApiKeyUI();
        loadBookmarklet();
        renderSourcesQueue();
    }

    function setupEventListeners() {
        // Source Pills Switcher
        elements.sourcePills.forEach(pill => {
            pill.addEventListener('click', () => {
                const type = pill.getAttribute('data-type');
                switchSourceType(type);
                elements.sourceInputPopover.classList.add('active');
            });
        });

        // Toggle Source Popover Bar
        elements.chipSourceToggle.addEventListener('click', () => {
            elements.sourceInputPopover.classList.toggle('active');
        });

        // Template Preset Selection
        elements.templateCards.forEach(card => {
            card.addEventListener('click', () => {
                elements.templateCards.forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                state.selectedTemplate = card.getAttribute('data-template');
                elements.chipTemplateLabel.textContent = TEMPLATE_NAMES[state.selectedTemplate] || 'NotebookLM Master Doc';
            });
        });

        elements.chipTemplateBtn.addEventListener('click', () => {
            // Scroll to welcome template grid if available
            const grid = document.querySelector('.template-grid');
            if (grid) grid.scrollIntoView({ behavior: 'smooth' });
        });

        // 1. Web Extraction
        elements.btnAddWebUrl.addEventListener('click', () => {
            const url = elements.webUrlInput.value.trim();
            if (!url) return showToast('Please enter a web URL', 'error');
            fetchSource('/api/parse-source', { type: 'web', input: url }, () => {
                elements.webUrlInput.value = '';
                elements.sourceInputPopover.classList.remove('active');
            });
        });

        // 2. YouTube Extraction
        elements.btnAddYtUrl.addEventListener('click', () => {
            const url = elements.ytUrlInput.value.trim();
            if (!url) return showToast('Please enter a YouTube video URL', 'error');
            fetchSource('/api/parse-source', { type: 'youtube', input: url }, () => {
                elements.ytUrlInput.value = '';
                elements.sourceInputPopover.classList.remove('active');
            });
        });

        // 3. Raw Text Addition
        elements.btnAddRawText.addEventListener('click', () => {
            const text = elements.rawTextInput.value.trim();
            if (!text) return showToast('Please enter note text', 'error');
            fetchSource('/api/parse-source', { type: 'text', input: text }, () => {
                elements.rawTextInput.value = '';
                elements.sourceInputPopover.classList.remove('active');
            });
        });

        // 4. Wikipedia Search
        elements.btnAddWiki.addEventListener('click', () => {
            const query = elements.wikiQueryInput.value.trim();
            if (!query) return showToast('Please enter a topic', 'error');
            fetchSource('/api/search-wikipedia', { query }, () => {
                elements.wikiQueryInput.value = '';
                elements.sourceInputPopover.classList.remove('active');
            });
        });

        // 5. File Upload Dropzone
        elements.fileDropzone.addEventListener('click', () => elements.fileInput.click());
        elements.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFileUpload(e.target.files[0]);
                elements.sourceInputPopover.classList.remove('active');
            }
        });

        // Clear All
        elements.btnClearAllSources.addEventListener('click', () => {
            state.sources = [];
            renderSourcesQueue();
            showToast('All sources cleared', 'info');
        });

        // Generate Notes
        elements.btnGenerateNotes.addEventListener('click', handleGenerateNotes);

        // Copy for NotebookLM
        elements.btnCopyForNotebookLM.addEventListener('click', copyNoteForNotebookLM);

        // Export Dropdown
        elements.btnExportDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
            elements.exportMenu.classList.toggle('show');
        });
        document.addEventListener('click', () => elements.exportMenu.classList.remove('show'));

        elements.exportMd.addEventListener('click', (e) => { e.preventDefault(); exportFile('md'); });
        elements.exportTxt.addEventListener('click', (e) => { e.preventDefault(); exportFile('txt'); });
        elements.exportHtml.addEventListener('click', (e) => { e.preventDefault(); exportFile('html'); });

        // Speech Synthesizer
        elements.btnAudioPlayer.addEventListener('click', handleSpeechSynthesis);

        // Modals
        elements.btnOpenApiKeyModal.addEventListener('click', () => {
            elements.modalApiKeyInput.value = state.apiKey;
            elements.apiKeyModal.classList.add('active');
        });
        if (elements.btnMobileApiKey) {
            elements.btnMobileApiKey.addEventListener('click', () => {
                elements.modalApiKeyInput.value = state.apiKey;
                elements.apiKeyModal.classList.add('active');
            });
        }
        elements.btnCloseApiKeyModal.addEventListener('click', () => elements.apiKeyModal.classList.remove('active'));

        elements.btnSaveApiKey.addEventListener('click', () => {
            state.apiKey = elements.modalApiKeyInput.value.trim();
            localStorage.setItem('omninotes_gemini_key', state.apiKey);
            updateApiKeyUI();
            elements.apiKeyModal.classList.remove('active');
            showToast('Gemini API Key saved!', 'success');
        });

        elements.btnRemoveApiKey.addEventListener('click', () => {
            state.apiKey = '';
            localStorage.removeItem('omninotes_gemini_key');
            elements.modalApiKeyInput.value = '';
            updateApiKeyUI();
            elements.apiKeyModal.classList.remove('active');
            showToast('API Key removed.', 'info');
        });

        elements.btnBookmarkletModal.addEventListener('click', () => elements.bookmarkletModal.classList.add('active'));
        elements.btnCloseBookmarkletModal.addEventListener('click', () => elements.bookmarkletModal.classList.remove('active'));
        elements.btnCloseBookmarkletModal2.addEventListener('click', () => elements.bookmarkletModal.classList.remove('active'));

        // History Drawer
        if (elements.btnMobileHistory) {
            elements.btnMobileHistory.addEventListener('click', openHistoryDrawer);
        }
        elements.btnCloseHistoryDrawer.addEventListener('click', () => elements.historyDrawer.classList.remove('active'));
    }

    function switchSourceType(type) {
        state.activeSourceType = type;
        elements.sourcePills.forEach(p => {
            p.classList.toggle('active', p.getAttribute('data-type') === type);
        });

        elements.popWeb.style.display = type === 'web' ? 'block' : 'none';
        elements.popYoutube.style.display = type === 'youtube' ? 'block' : 'none';
        elements.popFile.style.display = type === 'file' ? 'block' : 'none';
        elements.popText.style.display = type === 'text' ? 'block' : 'none';
        elements.popWiki.style.display = type === 'wiki' ? 'block' : 'none';
    }

    async function fetchSource(endpoint, payload, onSuccess) {
        showToast('Extracting source content...', 'info');
        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Failed to extract source');
            }

            state.sources.push(data.source);
            renderSourcesQueue();
            if (onSuccess) onSuccess();
            showToast(`Loaded: ${data.source.title}`, 'success');

        } catch (err) {
            showToast(err.message, 'error');
        }
    }

    async function handleFileUpload(file) {
        showToast(`Uploading ${file.name}...`, 'info');
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/upload-file', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.error || 'File upload failed');
            }

            state.sources.push(data.source);
            renderSourcesQueue();
            elements.fileInput.value = '';
            showToast(`File processed: ${data.source.title}`, 'success');

        } catch (err) {
            showToast(err.message, 'error');
        }
    }

    function renderSourcesQueue() {
        const count = state.sources.length;
        elements.sourceCountBadge.textContent = count;
        elements.btnClearAllSources.style.display = count > 0 ? 'inline-block' : 'none';
        elements.btnGenerateNotes.disabled = count === 0;

        if (count === 0) {
            elements.sourcesList.innerHTML = `
                <div class="empty-sources">
                    <i class="fa-regular fa-folder-open"></i>
                    <p>No sources loaded</p>
                    <span>Add links, videos, or PDFs below</span>
                </div>
            `;
            return;
        }

        const icons = {
            web: 'fa-globe',
            youtube: 'fa-brands fa-youtube',
            file: 'fa-file-pdf',
            text: 'fa-align-left',
            wikipedia: 'fa-book-bookmark'
        };

        elements.sourcesList.innerHTML = state.sources.map((src, index) => `
            <div class="source-item">
                <div class="source-item-info">
                    <i class="fa-solid ${icons[src.type] || 'fa-file'}"></i>
                    <span class="source-item-title" title="${src.title}">${src.title}</span>
                </div>
                <button class="source-item-remove" data-index="${index}">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        `).join('');

        document.querySelectorAll('.source-item-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.getAttribute('data-index'), 10);
                state.sources.splice(idx, 1);
                renderSourcesQueue();
                showToast('Source removed', 'info');
            });
        });
    }

    async function handleGenerateNotes() {
        if (state.sources.length === 0) return;

        elements.btnGenerateNotes.disabled = true;
        elements.btnGenerateNotes.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        
        elements.noteDisplayArea.innerHTML = `
            <div class="gemini-welcome-container">
                <div class="gemini-sparkle-hero">
                    <i class="fa-solid fa-sparkles fa-spin"></i>
                </div>
                <h2>Synthesizing NotebookLM Notes...</h2>
                <p>Grounding ${state.sources.length} source(s) into structured, Notion-formatted Markdown notes.</p>
            </div>
        `;

        try {
            const res = await fetch('/api/generate-notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sources: state.sources,
                    templateId: state.selectedTemplate,
                    apiKey: state.apiKey,
                    customInstructions: elements.customPromptInput.value.trim()
                })
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Failed to generate notes.');
            }

            state.currentNote = data.note;
            renderGeneratedNote(data.note);
            showToast(`Notes created (${data.note.wordCount} words)!`, 'success');

        } catch (err) {
            showToast(err.message, 'error');
            elements.noteDisplayArea.innerHTML = `
                <div class="gemini-welcome-container">
                    <h2 style="color: #ef4444;">Error Synthesizing Notes</h2>
                    <p>${err.message}</p>
                </div>
            `;
        } finally {
            elements.btnGenerateNotes.disabled = false;
            elements.btnGenerateNotes.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
        }
    }

    function renderGeneratedNote(note) {
        elements.canvasActions.style.display = 'flex';
        elements.canvasTitleText.textContent = note.title;

        const htmlContent = marked.parse(note.markdown);
        elements.noteDisplayArea.innerHTML = `
            <div class="rendered-markdown">
                ${htmlContent}
            </div>
        `;
    }

    function copyNoteForNotebookLM() {
        if (!state.currentNote) return;

        navigator.clipboard.writeText(state.currentNote.markdown).then(() => {
            showToast('📋 Copied formatted note! Ready for NotebookLM.', 'success');
            if (confirm("Note copied to clipboard!\n\nOpen Google NotebookLM now to paste this into your notebook?")) {
                window.open('https://notebooklm.google.com/', '_blank');
            }
        }).catch(() => {
            showToast('Failed to copy to clipboard automatically.', 'error');
        });
    }

    function exportFile(format) {
        if (!state.currentNote) return;

        let content = '';
        let filename = `${state.currentNote.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`;
        let mimeType = 'text/plain';

        if (format === 'md') {
            content = state.currentNote.markdown;
            filename += '.md';
            mimeType = 'text/markdown';
        } else if (format === 'txt') {
            content = state.currentNote.markdown.replace(/[#*`_]/g, '');
            filename += '.txt';
        } else if (format === 'html') {
            content = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${state.currentNote.title}</title><style>body{background:#0F0F0F;color:#EDEDED;font-family:sans-serif;line-height:1.6;max-width:800px;margin:40px auto;padding:0 20px;}blockquote{border-left:3px solid #555;padding-left:16px;color:#AAA;}</style></head><body>${marked.parse(state.currentNote.markdown)}</body></html>`;
            filename += '.html';
            mimeType = 'text/html';
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        showToast(`Exported ${filename}`, 'success');
    }

    function handleSpeechSynthesis() {
        if (!state.currentNote) return;

        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            showToast('Audio playback stopped.', 'info');
            return;
        }

        const cleanText = state.currentNote.markdown.replace(/[#*`_]/g, '');
        const utterance = new SpeechSynthesisUtterance(cleanText.slice(0, 3000));
        window.speechSynthesis.speak(utterance);
        showToast('🔊 Playing Audio Overview preview...', 'info');
    }

    async function openHistoryDrawer() {
        elements.historyDrawer.classList.add('active');
        try {
            const res = await fetch('/api/notebooks');
            const data = await res.json();
            
            if (data.notebooks && data.notebooks.length > 0) {
                elements.historyList.innerHTML = data.notebooks.map(n => `
                    <div class="history-item" data-id="${n.id}">
                        <div class="history-title">${n.title}</div>
                        <div class="history-meta">
                            <span>${n.sourceCount} sources • ~${n.wordCount} words</span>
                            <span>${new Date(n.createdAt).toLocaleDateString()}</span>
                        </div>
                    </div>
                `).join('');

                document.querySelectorAll('.history-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const noteId = item.getAttribute('data-id');
                        const selectedNote = data.notebooks.find(n => n.id === noteId);
                        if (selectedNote) {
                            state.currentNote = selectedNote;
                            renderGeneratedNote(selectedNote);
                            elements.historyDrawer.classList.remove('active');
                            showToast('Loaded saved note', 'success');
                        }
                    });
                });
            } else {
                elements.historyList.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:20px;">No saved notebooks.</p>';
            }
        } catch (e) {
            showToast('Failed to load history', 'error');
        }
    }

    function updateApiKeyUI() {
        if (state.apiKey) {
            elements.apiKeyBadge.textContent = 'API Key Active';
            elements.apiKeyBadge.style.color = '#FFFFFF';
        } else {
            elements.apiKeyBadge.textContent = 'Gemini API Key';
            elements.apiKeyBadge.style.color = 'var(--text-secondary)';
        }
    }

    async function loadBookmarklet() {
        try {
            const res = await fetch('/api/bookmarklet');
            const data = await res.json();
            elements.bookmarkletLink.href = data.bookmarklet;
        } catch (e) {}
    }

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span>${message}</span>`;
        elements.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
});
