/**
 * Generates browser bookmarklet code and helper scripts for 1-click injection into NotebookLM.
 */

function generateBookmarkletCode() {
    const rawJs = `
(function(){
    const text = window.__NOTEBOOKLM_NOTE_TEXT__ || prompt("Paste the note text to insert into NotebookLM:");
    if(!text) return;
    
    // Find text input or 'Copied text' modal in NotebookLM
    const selectors = [
        'textarea',
        '[contenteditable="true"]',
        'div[role="textbox"]'
    ];
    
    let target = null;
    for(const sel of selectors){
        const el = document.querySelector(sel);
        if(el){ target = el; break; }
    }

    if(target){
        target.value = text;
        target.textContent = text;
        target.dispatchEvent(new Event('input', { bubbles: true }));
        alert("✅ Note content successfully injected into NotebookLM!");
    } else {
        navigator.clipboard.writeText(text).then(() => {
            alert("📋 Note copied to clipboard! Click 'Add source' -> 'Copied text' in NotebookLM and press Ctrl+V / Cmd+V.");
        });
    }
})();
`.trim().replace(/\s+/g, ' ');

    return `javascript:${encodeURIComponent(rawJs)}`;
}

function generatePlaywrightScript(noteTitle, noteMarkdown) {
    return `// Playwright Automation Script for NotebookLM Sync
// Run: node sync_notebooklm.js

const { chromium } = require('playwright');

(async () => {
    // Launch browser with user profile if needed
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    
    console.log("Navigating to Google NotebookLM...");
    await page.goto('https://notebooklm.google.com/');
    
    console.log("Please select or create your Notebook target.");
    // Wait for user or target input
    await page.waitForTimeout(5000);
    
    console.log("Notes ready for copy/sync!");
})();
`;
}

module.exports = { generateBookmarkletCode, generatePlaywrightScript };
