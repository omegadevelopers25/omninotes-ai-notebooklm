const axios = require('axios');

/**
 * Extracts YouTube Video ID from various URL formats.
 * @param {string} url 
 * @returns {string|null}
 */
function extractYouTubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

/**
 * Fetches transcript/subtitles from a YouTube video URL.
 * @param {string} youtubeUrl 
 * @returns {Promise<{title: string, content: string, videoId: string, wordCount: number}>}
 */
async function getYouTubeTranscript(youtubeUrl) {
    const videoId = extractYouTubeId(youtubeUrl);
    if (!videoId) {
        throw new Error('Invalid YouTube URL format. Provide a valid video link.');
    }

    try {
        // Fetch YouTube Video Page HTML
        const response = await axios.get(`https://www.youtube.com/watch?v=${videoId}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });

        const html = response.data;

        // Extract video title
        const titleMatch = html.match(/<title>(.*?) - YouTube<\/title>/) || html.match(/<title>(.*?)<\/title>/);
        const title = titleMatch ? titleMatch[1].replace(/ - YouTube$/, '').trim() : `YouTube Video (${videoId})`;

        // Search for caption tracks in ytInitialPlayerResponse
        const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
        let captionTracks = [];

        if (playerResponseMatch) {
            try {
                const playerData = JSON.parse(playerResponseMatch[1]);
                captionTracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
            } catch (e) {
                console.warn('Failed to parse ytInitialPlayerResponse JSON');
            }
        }

        if (!captionTracks || captionTracks.length === 0) {
            // Fallback: search raw regex in HTML for timedtext URL
            const captionUrlMatch = html.match(/"captionTracks":\s*\[\s*{"baseUrl":\s*"(https:\/\/www\.youtube\.com\/api\/timedtext[^"]+)"/);
            if (captionUrlMatch) {
                const cleanUrl = captionUrlMatch[1].replace(/\\u0026/g, '&');
                captionTracks = [{ baseUrl: cleanUrl }];
            }
        }

        if (!captionTracks || captionTracks.length === 0) {
            throw new Error('No public captions or transcript found for this video. Note: Video must have closed captions enabled.');
        }

        // Prefer English track or first available track
        let selectedTrack = captionTracks.find(t => t.languageCode === 'en') || captionTracks[0];
        let captionUrl = selectedTrack.baseUrl.replace(/\\u0026/g, '&');
        if (!captionUrl.includes('&fmt=json3')) {
            captionUrl += '&fmt=json3';
        }

        const captionRes = await axios.get(captionUrl);
        const captionData = captionRes.data;

        let transcriptText = '';

        if (captionData && captionData.events) {
            const lines = [];
            for (const event of captionData.events) {
                if (event.segs) {
                    const line = event.segs.map(s => s.utf8).join('').replace(/\n/g, ' ').trim();
                    if (line && line !== '\n') {
                        lines.push(line);
                    }
                }
            }
            transcriptText = lines.join(' ').replace(/\s+/g, ' ');
        } else if (typeof captionData === 'string') {
            // XML format
            const cheerio = require('cheerio');
            const $ = cheerio.load(captionData, { xmlMode: true });
            const lines = [];
            $('text').each((_, el) => {
                const txt = $(el).text().trim();
                if (txt) lines.push(txt);
            });
            transcriptText = lines.join(' ');
        }

        if (!transcriptText || transcriptText.length < 50) {
            throw new Error('Extracted transcript content was too short or empty.');
        }

        const wordCount = transcriptText.split(/\s+/).filter(Boolean).length;

        return {
            title: `YouTube Video: ${title}`,
            content: `Video Title: ${title}\nVideo URL: https://www.youtube.com/watch?v=${videoId}\n\nTRANSCRIPT:\n${transcriptText}`,
            videoId,
            wordCount,
            url: `https://www.youtube.com/watch?v=${videoId}`
        };

    } catch (error) {
        console.error(`Error getting YouTube transcript for ${videoId}:`, error.message);
        throw new Error(`YouTube Transcript Error: ${error.message}`);
    }
}

module.exports = { extractYouTubeId, getYouTubeTranscript };
