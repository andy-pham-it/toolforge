const { Logger } = require('@andy-toolforge/core');

class SEOAnalyzer {
    constructor(config = {}) {
        this.logger = new Logger('SEOAnalyzer', config.logLevel);
    }

    _score(weighted) {
        const total = weighted.reduce((s, w) => s + w.score * w.weight, 0);
        const max = weighted.reduce((s, w) => s + w.weight, 0);
        return max === 0 ? 0 : Math.round((total / max) * 100);
    }

    _hasHashtags(text) {
        return /#\w+/.test(text);
    }

    _extractHashtags(text) {
        return (text.match(/#\w+/g) || []).map(h => h.slice(1));
    }

    async analyzeYouTube(title, description, tags) {
        if (typeof title !== 'string' || typeof description !== 'string') {
            throw new Error('title and description must be strings');
        }
        if (!Array.isArray(tags)) {
            throw new Error('tags must be an array');
        }

        this.logger.info('analyzeYouTube', { titleLength: title.length, descriptionLength: description.length, tagCount: tags.length });

        const suggestions = [];
        const checks = {};

        const firstTwoLines = description.split('\n').slice(0, 2).join(' ').toLowerCase();
        const titleLower = title.toLowerCase();
        const titleWords = titleLower.split(/\s+/).filter(Boolean);

        const keywordInFirstLines = titleWords.some(w => w.length > 3 && firstTwoLines.includes(w));
        checks.keywordInFirstLines = keywordInFirstLines;

        if (!keywordInFirstLines) {
            suggestions.push('Include a primary keyword from the title in the first 2 lines of the description');
        }

        const descLen = description.length;
        checks.descriptionLength = descLen;
        if (descLen < 200) {
            suggestions.push(`Description is too short (${descLen} chars). Aim for 200-500 chars`);
        } else if (descLen > 500) {
            suggestions.push(`Description is too long (${descLen} chars). Aim for 200-500 chars`);
        }

        const tagCount = tags.length;
        checks.tagCount = tagCount;
        if (tagCount < 3) {
            suggestions.push(`Too few tags (${tagCount}). Use 3-5 relevant tags`);
        } else if (tagCount > 5) {
            suggestions.push(`Too many tags (${tagCount}). Stick to 3-5 focused tags`);
        }

        const hashtags = description.match(/#\w+/g) || [];
        checks.hashtagCount = hashtags.length;
        if (hashtags.length === 0) {
            suggestions.push('Add 2-3 hashtags in the description for discoverability');
        }

        const weighted = [
            { score: keywordInFirstLines ? 1 : 0, weight: 3 },
            { score: descLen >= 200 && descLen <= 500 ? 1 : 0, weight: 2 },
            { score: tagCount >= 3 && tagCount <= 5 ? 1 : 0, weight: 2 },
            { score: hashtags.length >= 2 ? 1 : 0, weight: 1 },
        ];

        return {
            score: this._score(weighted),
            suggestions,
            details: {
                checks,
                descriptionLength: descLen,
                tagCount,
                hashtagCount: hashtags.length,
            },
        };
    }

    async analyzeFacebook(post, hashtags) {
        if (typeof post !== 'string') {
            throw new Error('post must be a string');
        }
        if (!Array.isArray(hashtags)) {
            throw new Error('hashtags must be an array');
        }

        this.logger.info('analyzeFacebook', { postLength: post.length, hashtagCount: hashtags.length });

        const suggestions = [];
        const checks = {};

        const firstLine = post.split('\n')[0] || post;
        const headlineLen = firstLine.length;
        checks.headlineLength = headlineLen;

        if (headlineLen < 40) {
            suggestions.push(`Headline is too short (${headlineLen} chars). Aim for 40-80 chars`);
        } else if (headlineLen > 80) {
            suggestions.push(`Headline is too long (${headlineLen} chars). Aim for 40-80 chars`);
        }

        const tagCount = hashtags.length;
        checks.hashtagCount = tagCount;
        if (tagCount < 2) {
            suggestions.push(`Too few hashtags (${tagCount}). Use 2-3 for better reach`);
        } else if (tagCount > 3) {
            suggestions.push(`Too many hashtags (${tagCount}). Stick to 2-3 on Facebook`);
        }

        const hasLink = /https?:\/\/[^\s]+/.test(post);
        checks.hasLink = hasLink;
        if (!hasLink) {
            suggestions.push('Include a link preview to drive traffic');
        }

        const weighted = [
            { score: headlineLen >= 40 && headlineLen <= 80 ? 1 : 0, weight: 3 },
            { score: tagCount >= 2 && tagCount <= 3 ? 1 : 0, weight: 2 },
            { score: hasLink ? 1 : 0, weight: 2 },
        ];

        return {
            score: this._score(weighted),
            suggestions,
            details: {
                checks,
                headlineLength: headlineLen,
                hashtagCount: tagCount,
                hasLink,
            },
        };
    }

    async analyzeTikTok(video, caption) {
        if (typeof video !== 'object' || video === null || Array.isArray(video)) {
            throw new Error('video must be an object');
        }
        if (typeof caption !== 'string') {
            throw new Error('caption must be a string');
        }

        this.logger.info('analyzeTikTok', { videoDuration: video.duration, captionLength: caption.length });

        const suggestions = [];
        const checks = {};

        const capLen = caption.length;
        checks.captionLength = capLen;
        if (capLen < 100) {
            suggestions.push(`Caption is too short (${capLen} chars). Aim for 100-150 chars`);
        } else if (capLen > 150) {
            suggestions.push(`Caption is too long (${capLen} chars). Aim for 100-150 chars`);
        }

        const hashtags = caption.match(/#\w+/g) || [];
        const tagCount = hashtags.length;
        checks.hashtagCount = tagCount;
        if (tagCount < 3) {
            suggestions.push(`Too few hashtags (${tagCount}). Use 3-5 for TikTok discoverability`);
        } else if (tagCount > 5) {
            suggestions.push(`Too many hashtags (${tagCount}). Stick to 3-5 hashtags`);
        }

        const hasHook = /[?!]/.test(caption.split('\n')[0] || caption);
        checks.hasHook = hasHook;
        if (!hasHook) {
            suggestions.push('Add a hook (question or exclamation) in the first line to grab attention');
        }

        const weighted = [
            { score: capLen >= 100 && capLen <= 150 ? 1 : 0, weight: 3 },
            { score: tagCount >= 3 && tagCount <= 5 ? 1 : 0, weight: 2 },
            { score: hasHook ? 1 : 0, weight: 2 },
        ];

        return {
            score: this._score(weighted),
            suggestions,
            details: {
                checks,
                captionLength: capLen,
                hashtagCount: tagCount,
                hasHook,
            },
        };
    }

    async generateKeywordCloud(text) {
        if (typeof text !== 'string') {
            throw new Error('text must be a string');
        }

        this.logger.info('generateKeywordCloud', { textLength: text.length });

        const words = text.toLowerCase()
            .replace(/[^a-z0-9\s#]/g, '')
            .split(/\s+/)
            .filter(Boolean);

        const stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'from', 'is', 'it', 'as', 'be', 'are', 'was',
            'were', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
            'will', 'would', 'could', 'should', 'may', 'might', 'shall', 'can',
            'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they',
            'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our',
            'their', 'not', 'no', 'nor', 'so', 'if', 'then', 'than', 'too', 'very',
            'just', 'about', 'up', 'out', 'also', 'more', 'some', 'any', 'each',
            'every', 'own', 'same', 'such', 'all', 'both', 'most', 'into', 'over',
        ]);

        const freq = {};
        for (const w of words) {
            if (w.length < 3 || stopWords.has(w) || w.startsWith('#')) continue;
            freq[w] = (freq[w] || 0) + 1;
        }

        const keywords = Object.entries(freq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([word, count]) => ({ word, count }));

        return {
            keywords,
            totalWords: words.length,
            uniqueWords: keywords.length,
        };
    }
}

module.exports = SEOAnalyzer;
