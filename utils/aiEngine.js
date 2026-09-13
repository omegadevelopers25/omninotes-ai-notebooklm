const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * AI Engine for generating Google NotebookLM optimized notes from single or multiple sources.
 */

// Prompt templates for different note styles
const TEMPLATE_PROMPTS = {
    'notebooklm-master': `You are an expert Knowledge Architect specializing in preparing high-quality source documents for Google NotebookLM (Gemini Notebook).
Your task is to synthesize the provided source material(s) into a unified, authoritative "Master Source Document" that will maximize NotebookLM's RAG capabilities, chat Q&A, and Audio Overview podcast generation.

Structure your response strictly in Clean Markdown with the following sections:

# 📚 [PROJECT / NOTEBOOK TITLE]
> **Source Metadata**: [Count] Sources | **Topics**: [Primary Topics Covered] | **Generated**: ${new Date().toISOString().split('T')[0]}

---

## 🎯 Executive Summary & Core Thesis
- Provide a crystal-clear 3-paragraph executive summary synthesizing the overall content across all sources.
- Highlight the single primary thesis or goal of this material.

---

## 💡 Key Takeaways & Core Concepts
- Bullet point 5-8 essential insights, facts, or takeaways.
- Bold key terms for emphasis.

---

## 📖 Deep-Dive Detailed Notes (Section by Section)
Organize into logical thematic headings (### 1. Header Name, ### 2. Header Name):
- Deeply explain facts, definitions, technical mechanisms, and background context.
- Keep explanation thorough, unambiguous, and self-contained.
- Include quotes or direct source references where impactful.

---

## ❓ Critical Q&A & Discussion Points (NotebookLM Chat Prompt Ready)
Provide 5 insightful Questions and comprehensive Answers based on the sources:
- **Q1**: [Analytical question]
  - **Answer**: [Detailed answer]

---

## 🔊 Audio Overview Podcast Script (For NotebookLM Audio Generation)
Write a 1-minute engaging conversational podcast snippet between two co-hosts (Host A & Host B) summarizing this material:
- **Host A**: ...
- **Host B**: ...

---

## 🔗 Source Attribution & Reference Index
List each source provided with its main contribution.`,

    'executive-briefing': `You are a Chief Strategy Advisor writing an Executive Briefing Document based on the provided source materials.

Structure in Markdown:
# 📑 Executive Briefing: [Subject Title]
- **Target Audience**: Executives, Stakeholders, Strategy Team
- **Date**: ${new Date().toISOString().split('T')[0]}

## ⚡ Context & Background
Brief background on why this matter is significant.

## 🔑 Key Findings & Strategic Insights
Bulleted list of high-impact strategic observations.

## 🔍 Detailed Analysis
Detailed breakdown divided into logical thematic sections.

## ⚠️ Risks, Challenges & Considerations
Potential bottlenecks, caveats, or missing information.

## 🚀 Actionable Recommendations
Clear next steps and action items.`,

    'study-guide': `You are an elite Educational Specialist creating a Comprehensive Study Guide & Flashcard Set for student learning & review.

Structure in Markdown:
# 🎓 Master Study Guide & Flashcards: [Subject Title]

## 📌 Core Vocabulary & Glossary
- **Term 1**: Clear concise definition.
- **Term 2**: Clear concise definition.

## 🧠 Core Principles & Conceptual Framework
Breakdown of primary concepts with clear explanations and real-world examples.

## 🎴 Flashcards & Active Recall Questions
Format as Q&A flashcard cards:
---
**Card 1**: [Question]
*Answer*: [Answer with explanation]
---

## 📝 Practice Quiz & Knowledge Check
5 Multiple-Choice or Open-ended Practice Questions with an Answer Key at the end.`,

    'mindmap-outline': `You are an Information Architect creating a Hierarchical Mind Map & Structured Outline.

Structure in Markdown:
# 🗺️ Structured Mind Map & Knowledge Tree: [Topic]

Use multi-level nested markdown list bullets to form a visual mind map hierarchy:
- 🌳 **Central Topic**
  - 🌿 **Branch 1: Core Sub-topic**
    - 🍃 Element 1.1: Explanation
    - 🍃 Element 1.2: Detail
  - 🌿 **Branch 2: Technical Breakdown**
    - 🍃 Element 2.1: Detail
    - 🍃 Element 2.2: Mechanism

Include a **Conceptual Linkage Matrix** at the end showing how key ideas connect across sources.`,

    'audio-podcast-script': `You are an award-winning Science & Tech Podcast Producer designing an Audio Script specifically for Google NotebookLM's Audio Overview feature.

Structure in Markdown:
# 🎙️ NotebookLM Podcast Script: Deep Dive Discussion

Write a dynamic, natural, 2-person podcast conversation between Host A (curious, enthusiastic, asking probing questions) and Host B (domain expert, insightful, breaking down complex topics):

[HOST A]: ...
[HOST B]: ...

(Include 8-12 full back-and-forth dialogue exchanges that cover all critical points from the sources in a conversational tone).`
};

/**
 * Main function to generate structured notes using Gemini API or Offline Fallback.
 * @param {Array<{title: string, content: string, url?: string, domain?: string}>} sources 
 * @param {string} templateId - NotebookLM template choice
 * @param {string} [customApiKey] - Optional API key supplied by user
 * @param {string} [customInstructions] - Optional extra prompt guidelines
 * @returns {Promise<{markdown: string, summary: string, sourceCount: number, wordCount: number, method: 'gemini'|'offline'}>}
 */
async function generateNotes(sources, templateId = 'notebooklm-master', customApiKey = '', customInstructions = '') {
    if (!sources || sources.length === 0) {
        throw new Error('At least one source is required to generate notes.');
    }

    const apiKey = customApiKey || process.env.GEMINI_API_KEY;

    // Combine source text
    let combinedSourcesText = sources.map((src, index) => {
        return `=== SOURCE #${index + 1}: ${src.title} ===\nURL/Origin: ${src.url || src.filename || 'Direct Input'}\n\n${src.content}\n`;
    }).join('\n\n----------------------------------------\n\n');

    // If API Key is available, call Google Gemini
    if (apiKey) {
        try {
            console.log(`Generating notes using Gemini API (Template: ${templateId})...`);
            const genAI = new GoogleGenerativeAI(apiKey);
            
            // Use gemini-1.5-flash or gemini-2.0-flash (fallback to gemini-pro if needed)
            let model;
            try {
                model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            } catch (e) {
                model = genAI.getGenerativeModel({ model: 'gemini-pro' });
            }

            const promptTemplate = TEMPLATE_PROMPTS[templateId] || TEMPLATE_PROMPTS['notebooklm-master'];
            
            const fullPrompt = `${promptTemplate}

${customInstructions ? `\n\nADDITIONAL INSTRUCTIONS FROM USER:\n${customInstructions}\n` : ''}

SOURCE MATERIALS PROVIDED (${sources.length} sources):
${combinedSourcesText}

Generate the complete, beautifully formatted Markdown notes now:`;

            const result = await model.generateContent(fullPrompt);
            const response = await result.response;
            const markdown = response.text();

            const wordCount = markdown.split(/\s+/).filter(Boolean).length;
            const summary = markdown.slice(0, 300).replace(/[#*`_]/g, '') + '...';

            return {
                markdown,
                summary,
                sourceCount: sources.length,
                wordCount,
                method: 'gemini'
            };

        } catch (geminiError) {
            console.warn('Gemini API call failed or key invalid, falling back to smart offline generator:', geminiError.message);
        }
    }

    // Smart Offline Algorithmic Generator (Fallback when no API key)
    console.log(`Generating notes using Smart Algorithmic Generator (Template: ${templateId})...`);
    return generateOfflineNotes(sources, templateId, customInstructions);
}

/**
 * Smart Algorithmic Note Synthesizer (Works without external API key)
 */
function generateOfflineNotes(sources, templateId, customInstructions) {
    const mainTitle = sources.length === 1 ? sources[0].title : `Notebook Synthesis (${sources.length} Sources)`;
    
    // Extract key sentences across sources
    let allSentences = [];
    sources.forEach(src => {
        const sentences = src.content.split(/(?<=[.?!])\s+/).filter(s => s.trim().length > 30);
        allSentences.push(...sentences);
    });

    // Score sentences by word frequency
    const wordFreq = {};
    const stopWords = new Set(['the','and','to','of','a','in','is','that','for','it','as','was','with','on','are','by','this','be','at','or','from','an','an','have','has','had','not','but','what','all','were','when','we','there','can','an']);
    
    allSentences.forEach(s => {
        const words = s.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/);
        words.forEach(w => {
            if (w.length > 3 && !stopWords.has(w)) {
                wordFreq[w] = (wordFreq[w] || 0) + 1;
            }
        });
    });

    // Sort top terms
    const topTerms = Object.keys(wordFreq).sort((a,b) => wordFreq[b] - wordFreq[a]).slice(0, 10);
    
    // Score sentences
    const scoredSentences = allSentences.map(s => {
        let score = 0;
        const words = s.toLowerCase().split(/\s+/);
        words.forEach(w => {
            if (wordFreq[w]) score += wordFreq[w];
        });
        return { text: s, score };
    }).sort((a, b) => b.score - a.score);

    const topSentences = scoredSentences.slice(0, 8).map(s => s.text);
    const keyTakeaways = scoredSentences.slice(8, 14).map(s => s.text);

    let markdown = `# 📚 ${mainTitle}
> **NotebookLM Source Document** | **Sources**: ${sources.length} | **Date**: ${new Date().toISOString().split('T')[0]}
> *Generated by OmniNotes AI Engine (NotebookLM Optimized)*

---

## 🎯 Executive Summary & Overview
${topSentences.slice(0, 3).join(' ')}

${topSentences.slice(3, 6).join(' ')}

---

## 💡 Key Insights & Takeaways
${keyTakeaways.map(t => `- **Key Finding**: ${t}`).join('\n')}

---

## 📖 Comprehensive Source Synthesis
${sources.map((src, idx) => `
### 📑 Source ${idx + 1}: ${src.title}
* **Origin**: ${src.domain || src.filename || 'Direct Input'}
* **Word Count**: ~${src.wordCount} words

#### Core Content Summary:
${src.content.slice(0, 800).replace(/\n{2,}/g, '\n\n')}...

---
`).join('\n')}

## 🔑 Key Vocabulary & Concepts
${topTerms.map(term => `- **${term.toUpperCase()}**: Frequently cited key concept across the source material.`).join('\n')}

---

## ❓ Discussion & Q&A (NotebookLM Chat Prompt Ready)
${topSentences.slice(0, 4).map((s, i) => `
**Q${i + 1}: What is the significance of "${topTerms[i] || 'this concept'}" in the source material?**
> **Answer**: ${s}
`).join('\n')}

---

## 🔊 Audio Overview Podcast Script (NotebookLM Preview)
**Host A**: Welcome back! Today we're diving into "${mainTitle}". We have ${sources.length} rich sources to explore.
**Host B**: Absolutely! Looking at the material, the core thesis focuses on ${topTerms.slice(0,3).join(', ')}.
**Host A**: Right, and one of the most interesting points highlighted is: "${topSentences[0] || ''}".
**Host B**: Exactly. If you're building a notebook in NotebookLM around this, this is the foundational concept to index!

---
## 🔗 Source Reference Index
${sources.map((s, i) => `${i + 1}. **${s.title}** (${s.url || s.filename || 'Uploaded Source'})`).join('\n')}
`;

    const wordCount = markdown.split(/\s+/).filter(Boolean).length;
    const summary = topSentences.slice(0, 2).join(' ');

    return {
        markdown,
        summary,
        sourceCount: sources.length,
        wordCount,
        method: 'offline'
    };
}

module.exports = { generateNotes, TEMPLATE_PROMPTS };
