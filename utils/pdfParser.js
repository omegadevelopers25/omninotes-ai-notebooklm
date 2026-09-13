const pdfParse = require('pdf-parse');
const fs = require('fs');

/**
 * Extracts text from an uploaded file (PDF, TXT, MD, etc.)
 * @param {Object} file - Express multer file object
 * @returns {Promise<{title: string, content: string, wordCount: number}>}
 */
async function parseUploadedFile(file) {
    if (!file) {
        throw new Error('No file provided');
    }

    const filename = file.originalname || 'Uploaded Document';
    const mimeType = file.mimetype || '';
    let extractedText = '';

    try {
        if (mimeType.includes('pdf') || filename.endsWith('.pdf')) {
            const dataBuffer = fs.readFileSync(file.path);
            const pdfData = await pdfParse(dataBuffer);
            extractedText = pdfData.text || '';
        } else {
            // Read as text (TXT, MD, CSV, JSON, LOG, etc.)
            extractedText = fs.readFileSync(file.path, 'utf8');
        }

        // Clean file after reading
        try { fs.unlinkSync(file.path); } catch (e) {}

        const cleanText = extractedText.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

        if (cleanText.length < 10) {
            throw new Error('The file appears to be empty or contains unreadable text.');
        }

        const wordCount = cleanText.split(/\s+/).filter(Boolean).length;

        return {
            title: filename.replace(/\.[^/.]+$/, ""),
            content: cleanText,
            wordCount,
            filename
        };

    } catch (error) {
        console.error(`Error parsing file ${filename}:`, error.message);
        // Clean file on error
        try { fs.unlinkSync(file.path); } catch (e) {}
        throw new Error(`File Parsing Error (${filename}): ${error.message}`);
    }
}

module.exports = { parseUploadedFile };
