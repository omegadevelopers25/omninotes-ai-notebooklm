const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Scrapes a web URL and extracts clean readable main content text, title, and metadata.
 * @param {string} url 
 * @returns {Promise<{title: string, content: string, domain: string, author?: string, wordCount: number}>}
 */
async function scrapeWebUrl(url) {
    try {
        // Validate URL
        const parsedUrl = new URL(url);
        const domain = parsedUrl.hostname.replace('www.', '');

        // Fetch HTML content with standard user agent
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webkit,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            },
            timeout: 12000
        });

        const html = response.data;
        const $ = cheerio.load(html);

        // Remove script, style, nav, footer, ads, sidebars
        $('script, style, noscript, nav, footer, header, svg, iframe, .ads, .ad, .social-share, .comments, #comments').remove();

        // Extract title
        let title = $('og:title').attr('content') || 
                    $('twitter:title').attr('content') || 
                    $('h1').first().text().trim() || 
                    $('title').text().trim() || 
                    'Web Article';

        title = title.replace(/\s+/g, ' ');

        // Extract main text content
        let textBlocks = [];

        // Priority selectors for main content
        const mainSelectors = ['article', 'main', '.content', '#content', '.post-content', '.article-body', '.entry-content', '.mw-parser-output'];
        let $mainContainer = null;

        for (const selector of mainSelectors) {
            if ($(selector).length > 0) {
                $mainContainer = $(selector).first();
                break;
            }
        }

        if ($mainContainer) {
            $mainContainer.find('p, h1, h2, h3, h4, li, blockquote').each((_, el) => {
                const text = $(el).text().trim();
                if (text.length > 20) {
                    textBlocks.push(text);
                }
            });
        } else {
            // Fallback to all paragraph tags
            $('p, h1, h2, h3, li').each((_, el) => {
                const text = $(el).text().trim();
                if (text.length > 25) {
                    textBlocks.push(text);
                }
            });
        }

        const fullContent = textBlocks.join('\n\n');
        const cleanContent = fullContent.replace(/\n{3,}/g, '\n\n').trim();
        const wordCount = cleanContent.split(/\s+/).filter(Boolean).length;

        if (cleanContent.length < 100) {
            throw new Error('Could not extract sufficient text content from this URL. The site might require login or JavaScript execution.');
        }

        return {
            title,
            content: cleanContent,
            domain,
            url,
            wordCount
        };

    } catch (error) {
        console.error(`Error scraping URL ${url}:`, error.message);
        throw new Error(`Failed to scrape web page (${url}): ${error.message}`);
    }
}

module.exports = { scrapeWebUrl };
