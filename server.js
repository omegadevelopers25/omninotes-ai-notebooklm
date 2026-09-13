const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const axios = require('axios');
require('dotenv').config();

const { scrapeWebUrl } = require('./utils/scraper');
const { getYouTubeTranscript, extractYouTubeId } = require('./utils/youtube');
const { parseUploadedFile } = require('./utils/pdfParser');
const { generateNotes } = require('./utils/aiEngine');
const { generateBookmarkletCode } = require('./utils/bookmarklet');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS & JSON parsing
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Configure Multer for file uploads
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

// Data directory for saving notebooks history
const dataDir = path.join(__dirname, 'data');
const notebooksFilePath = path.join(dataDir, 'notebooks.json');

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(notebooksFilePath)) {
    fs.writeFileSync(notebooksFilePath, JSON.stringify([], null, 2));
}

// Helper to read saved notebooks
function getSavedNotebooks() {
    try {
        const raw = fs.readFileSync(notebooksFilePath, 'utf8');
        return JSON.parse(raw);
    } catch (e) {
        return [];
    }
}

// Helper to save notebooks
function saveNotebooks(data) {
    fs.writeFileSync(notebooksFilePath, JSON.stringify(data, null, 2));
}

// -------------------------------------------------------------
// API ENDPOINTS
// -------------------------------------------------------------

/**
 * POST /api/parse-source
 * Automatically detects source type (URL, YouTube link, Wikipedia search) and extracts clean content.
 */
app.post('/api/parse-source', async (req, res) => {
    try {
        const { type, input } = req.body;

        if (!input || !input.trim()) {
            return res.status(400).json({ error: 'Please provide a valid input or URL.' });
        }

        const trimmedInput = input.trim();

        // 1. YouTube Link Check
        if (extractYouTubeId(trimmedInput)) {
            console.log(`Fetching YouTube transcript for: ${trimmedInput}`);
            const ytData = await getYouTubeTranscript(trimmedInput);
            return res.json({
                success: true,
                source: {
                    id: 'src_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                    type: 'youtube',
                    title: ytData.title,
                    content: ytData.content,
                    url: ytData.url,
                    domain: 'youtube.com',
                    wordCount: ytData.wordCount
                }
            });
        }

        // 2. Web URL Check
        if (trimmedInput.startsWith('http://') || trimmedInput.startsWith('https://')) {
            console.log(`Scraping web page: ${trimmedInput}`);
            const scraped = await scrapeWebUrl(trimmedInput);
            return res.json({
                success: true,
                source: {
                    id: 'src_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                    type: 'web',
                    title: scraped.title,
                    content: scraped.content,
                    url: scraped.url,
                    domain: scraped.domain,
                    wordCount: scraped.wordCount
                }
            });
        }

        // 3. Raw Text Input
        const wordCount = trimmedInput.split(/\s+/).filter(Boolean).length;
        const title = trimmedInput.slice(0, 45).replace(/\n/g, ' ') + (trimmedInput.length > 45 ? '...' : '');
        
        return res.json({
            success: true,
            source: {
                id: 'src_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                type: 'text',
                title: `Text Note: ${title}`,
                content: trimmedInput,
                domain: 'Direct Input',
                wordCount
            }
        });

    } catch (error) {
        console.error('Error parsing source:', error.message);
        res.status(500).json({ error: error.message || 'Failed to parse source.' });
    }
});

/**
 * POST /api/upload-file
 * Handles file upload (PDF, TXT, MD, DOC)
 */
app.post('/api/upload-file', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }

        console.log(`Parsing uploaded file: ${req.file.originalname}`);
        const parsed = await parseUploadedFile(req.file);

        res.json({
            success: true,
            source: {
                id: 'src_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                type: 'file',
                title: parsed.title,
                content: parsed.content,
                filename: parsed.filename,
                domain: 'Uploaded File',
                wordCount: parsed.wordCount
            }
        });

    } catch (error) {
        console.error('Error uploading file:', error.message);
        res.status(500).json({ error: error.message || 'Failed to upload and parse file.' });
    }
});

/**
 * POST /api/search-wikipedia
 * Quick research fetch from Wikipedia
 */
app.post('/api/search-wikipedia', async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) return res.status(400).json({ error: 'Query is required.' });

        console.log(`Searching Wikipedia for: ${query}`);
        const wikiRes = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
        
        if (wikiRes.data && wikiRes.data.extract) {
            const data = wikiRes.data;
            const fullContent = `WIKIPEDIA ARTICLE: ${data.title}\nDescription: ${data.description || ''}\nURL: ${data.content_urls?.desktop?.page || ''}\n\nSUMMARY:\n${data.extract}`;
            const wordCount = fullContent.split(/\s+/).filter(Boolean).length;

            return res.json({
                success: true,
                source: {
                    id: 'src_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                    type: 'wikipedia',
                    title: `Wikipedia: ${data.title}`,
                    content: fullContent,
                    url: data.content_urls?.desktop?.page,
                    domain: 'wikipedia.org',
                    wordCount
                }
            });
        } else {
            throw new Error('No article found for this topic.');
        }
    } catch (error) {
        res.status(404).json({ error: `Wikipedia topic not found (${error.message})` });
    }
});

/**
 * POST /api/generate-notes
 * Synthesizes notes from multiple sources using Gemini API or Offline Engine
 */
app.post('/api/generate-notes', async (req, res) => {
    try {
        const { sources, templateId, apiKey, customInstructions } = req.body;

        if (!sources || !Array.isArray(sources) || sources.length === 0) {
            return res.status(400).json({ error: 'Please add at least one source before generating notes.' });
        }

        console.log(`Generating notes for ${sources.length} sources...`);
        const result = await generateNotes(sources, templateId, apiKey, customInstructions);

        // Auto-save to history
        const savedNotebooks = getSavedNotebooks();
        const mainTitle = sources.length === 1 ? sources[0].title : `Notebook: ${sources[0].title} (+${sources.length - 1} sources)`;
        
        const newNoteItem = {
            id: 'note_' + Date.now(),
            title: mainTitle,
            markdown: result.markdown,
            summary: result.summary,
            templateId: templateId || 'notebooklm-master',
            sourceCount: result.sourceCount,
            wordCount: result.wordCount,
            method: result.method,
            createdAt: new Date().toISOString(),
            sources: sources.map(s => ({ title: s.title, domain: s.domain, url: s.url || s.filename }))
        };

        savedNotebooks.unshift(newNoteItem);
        // Keep max 50 recent notes
        if (savedNotebooks.length > 50) savedNotebooks.pop();
        saveNotebooks(savedNotebooks);

        res.json({
            success: true,
            note: newNoteItem
        });

    } catch (error) {
        console.error('Error generating notes:', error.message);
        res.status(500).json({ error: error.message || 'Failed to generate notes.' });
    }
});

/**
 * GET /api/notebooks
 * Retrieves saved notebooks history
 */
app.get('/api/notebooks', (req, res) => {
    const notebooks = getSavedNotebooks();
    res.json({ success: true, notebooks });
});

/**
 * DELETE /api/notebooks/:id
 * Deletes a note from saved history
 */
app.delete('/api/notebooks/:id', (req, res) => {
    const { id } = req.params;
    let notebooks = getSavedNotebooks();
    notebooks = notebooks.filter(n => n.id !== id);
    saveNotebooks(notebooks);
    res.json({ success: true, notebooks });
});

/**
 * GET /api/bookmarklet
 * Gets the bookmarklet javascript string
 */
app.get('/api/bookmarklet', (req, res) => {
    res.json({ bookmarklet: generateBookmarkletCode() });
});

// Start Server
app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 NotebookLM Auto-Notes Maker is running!`);
    console.log(`🌐 Local Web App: http://localhost:${PORT}`);
    console.log(`=======================================================`);
});
