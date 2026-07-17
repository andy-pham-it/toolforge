'use strict';

/**
 * Ecosystem catalog for @andy-toolforge packages.
 * Used by the `toolforge_ecosystem` MCP tool to help external AI agents
 * discover what packages exist and what they can do.
 */

const CATALOG = [
    {
        name: '@andy-toolforge/core',
        version: '1.2.0',
        description: 'Toolforge foundation: browser manager, LLM client, logger, job queue',
        useCases: [
            'Any project that needs an LLM client with multi-provider failover (Gemini → Groq)',
            'Automation needing a Puppeteer browser lifecycle manager',
            'Structured logging across distributed services',
            'Async FIFO job queue for background processing',
        ],
        keyExports: [
            { name: 'LLMClient', description: 'Multi-provider LLM client with adapter chain failover' },
            { name: 'ProviderAdapter', description: 'Abstract base class for provider adapters' },
            { name: 'OpenAIAdapter', description: 'OpenAI-compatible adapter (works with Groq, Gemini OpenAI-mode, etc.)' },
            { name: 'BrowserManager', description: 'Puppeteer browser lifecycle (launch, page pool, cleanup)' },
            { name: 'Logger', description: 'Structured logger with levels (debug, info, warn, error)' },
            { name: 'JobQueue', description: 'Async FIFO queue with concurrency control' },
        ],
        dependencies: ['puppeteer', 'uuid'],
        skillFiles: false,
    },
    {
        name: '@andy-toolforge/genai-tools',
        version: '0.1.2',
        description: 'Google GenAI SDK tools: GenAIAdapter, search grounding, structured extraction',
        useCases: [
            'Add Gemini-native GenAIAdapter to an LLMClient adapter chain',
            'Search-grounded question answering with Google Search via Gemini',
            'Extract structured JSON from unstructured text using Gemini responseSchema',
        ],
        keyExports: [
            { name: 'GenAIAdapter', description: 'ProviderAdapter wrapping @google/genai SDK for Gemini' },
            { name: 'GenAIClient', description: 'Direct Google GenAI SDK client (standalone, no adapter chain)' },
            { name: 'searchGrounding', description: 'Search-grounded Gemini answer with cited sources' },
            { name: 'extractStructured', description: 'Extract structured JSON from text via Gemini responseSchema' },
        ],
        dependencies: ['@andy-toolforge/core', '@google/genai'],
        skillFiles: false,
    },
    {
        name: '@andy-toolforge/mcp',
        version: '1.3.5',
        description: 'MCP server exposing @andy-toolforge tools over Model Context Protocol',
        useCases: [
            'Expose @andy-toolforge tools to AI coding agents via MCP protocol',
            'Bridge LLMClient + tools into Claude/OpenCode/Cursor etc.',
            'Plugin discovery of mcp-tools.js from all installed @andy-toolforge packages',
        ],
        keyExports: [
            { name: 'MCPServer', description: 'Full MCP server class with JSON-RPC handling' },
            { name: 'createServer(config)', description: 'Factory function to create and start MCPServer' },
        ],
        dependencies: ['@andy-toolforge/core', ...['content-research', 'footage-generation', 'seo-generation', 'content-operations', 'ba-support', 'book-writing', 'pm-support', 'coding-support', 'tts-generator', 'vn-stock', 'voice-assistant'].map(p => `@andy-toolforge/${p}`)],
        skillFiles: false,
    },
    {
        name: '@andy-toolforge/footage-generation',
        version: '1.3.1',
        description: 'Generate images, videos, and visuals for podcasts and content',
        useCases: [
            'Generate podcast/video cover images via Gemini Images browser automation',
            'Overlay text on images (via sharp)',
            'Generate image prompts from scripts (5 visual styles: surrealist, lineart, comparison, typography, infographic)',
            'Map background music and sound design to script segments',
        ],
        keyExports: [
            { name: 'ImageGenerator', description: 'Spawn image/video generation via Gemini Images browser automation' },
            { name: 'TextOverlayer', description: 'Overlay text on images via sharp' },
            { name: 'PromptWriter', description: 'Image prompt template management with visual style classification' },
            { name: 'LLMClient', description: 'Domain-specific LLMClient extending CoreLLMClient with analyzeScript() etc.' },
        ],
        dependencies: ['@andy-toolforge/core', 'puppeteer', 'sharp'],
        skillFiles: true,
        skillPrefix: 'footage-generation',
    },
    {
        name: '@andy-toolforge/seo-generation',
        version: '1.0.1',
        description: 'SEO content generation for YouTube, TikTok, blog',
        useCases: [
            'Generate YouTube/TikTok/Facebook SEO metadata (title, description, tags, keywords, timestamps)',
            'Content arbitrage — repurpose content across platforms',
            'Multi-platform publishing via REST APIs (YouTube, TikTok, Facebook)',
        ],
        keyExports: [
            { name: 'SEOAnalyzer', description: 'YouTube/TikTok/Facebook SEO analysis and metadata generation' },
            { name: 'ContentArbitrageEngine', description: 'Repurpose content across platforms with adaptation' },
            { name: 'MultiPlatformPublisher', description: 'Publish to YouTube/TikTok/Facebook via REST' },
        ],
        dependencies: ['@andy-toolforge/core'],
        skillFiles: true,
        skillPrefix: 'seo-generation',
    },
    {
        name: '@andy-toolforge/tts-generator',
        version: '0.5.0',
        description: 'Text-to-speech generation using Gemini TTS models',
        useCases: [
            'Generate podcast voiceover from scripts (30 Gemini TTS voices)',
            'Smart script segmentation via LLM for natural speech pacing',
            'Multi-voice dialogs with AI-powered audio tag injection',
            'Batch/single/stream output modes',
            'Live WebSocket TTS via Gemini Live API',
        ],
        keyExports: [
            { name: 'TTSPlanner', description: 'Script segmentation (LLM + regex fallback)' },
            { name: 'TTSGenerator', description: 'Gemini TTS via Interactions REST API' },
            { name: 'LiveTTSGenerator', description: 'Gemini TTS via Live WebSocket API' },
            { name: 'OutputFormatter', description: 'Output formatting (batch/single/stream)' },
            { name: 'TTSPlugin', description: 'Express / NestJS plugin for web integration' },
        ],
        dependencies: ['@andy-toolforge/core', '@google/genai', 'express'],
        skillFiles: true,
        skillPrefix: 'tts-generator',
    },
    {
        name: '@andy-toolforge/vn-stock',
        version: '0.2.2',
        description: 'VN stock screener and scanner — technical analysis from MongoDB data',
        useCases: [
            'Screen/filter/scoring VN stocks by technical conditions (daily + intraday 15m/1h)',
            'Detect 17 candlestick + indicator signals',
            'Multi-factor ranking (technical 40%, volume 20%, momentum 20%, fundamental 20%)',
            'Stock info with daily/intraday/fundamental data from MongoDB',
            'Analyst report with BUY/HOLD/SELL recommendation',
        ],
        keyExports: [
            { name: 'StockDB', description: 'MongoDB connection and query helpers' },
            { name: 'StockScreener', description: 'Filter stocks by technical conditions (daily + intraday)' },
            { name: 'StockScorer', description: 'Multi-factor scoring engine' },
            { name: 'SignalDetector', description: '17 candlestick + indicator signal detection methods' },
            { name: 'Analyst', description: 'AI-powered analyst with recommendation engine' },
            { name: 'IndicatorEngine', description: 'Technical indicator calculation engine' },
        ],
        dependencies: ['@andy-toolforge/core', '@andy-toolforge/genai-tools', 'mongodb'],
        skillFiles: true,
        skillPrefix: 'vn-stock',
    },
    {
        name: '@andy-toolforge/content-research',
        version: '0.1.1',
        description: 'Domain package for content research, summarization, idea generation, article management, and competitor analysis',
        useCases: [
            'Summarize articles/reports via LLM with Vietnamese skill-file prompts',
            'Generate content ideas by topic/audience/format',
            'Classify, tag, summarize, and improve articles via LLM',
            'Crawl competitor URLs and analyze via LLM with SWOT framework',
        ],
        keyExports: [
            { name: 'ContentSummarizer', description: 'Summarize content via LLM with skill-file prompts' },
            { name: 'ContentIdeator', description: 'Generate content ideas' },
            { name: 'ArticleManager', description: 'Article lifecycle (classify, tag, summarize, improve)' },
            { name: 'CompetitorAnalyzer', description: 'Crawl competitor URL + analyze via LLM (Puppeteer)' },
            { name: 'LLMClient', description: 'Domain-specific LLMClient extending CoreLLMClient with content methods' },
        ],
        dependencies: ['@andy-toolforge/core', 'puppeteer'],
        skillFiles: true,
        skillPrefix: 'content-research',
    },
    {
        name: '@andy-toolforge/content-operations',
        version: '1.0.1',
        description: 'Content operations — research, plan, create, distribute, analyze',
        useCases: [
            'Research trending topics, keywords, and content gaps',
            'Build content calendars and schedule posts',
            'Generate content from plans via LLM',
            'Push content to platforms programmatically',
            'Track performance and generate analytics reports',
        ],
        keyExports: [
            { name: 'ContentResearcher', description: 'Research trending topics, keywords, content gaps' },
            { name: 'ContentPlanner', description: 'Build content calendars, schedule posts' },
            { name: 'ContentCreator', description: 'Generate content from plans via LLM' },
            { name: 'ContentDistributor', description: 'Push content to platforms' },
            { name: 'ContentAnalytics', description: 'Track performance, generate reports' },
            { name: 'ContentPatternLinter', description: 'Check content quality & pattern compliance' },
        ],
        dependencies: ['@andy-toolforge/core'],
        skillFiles: true,
        skillPrefix: 'content-operations',
    },
    {
        name: '@andy-toolforge/book-writing',
        version: '1.0.1',
        description: 'Book writing engine — outline generation, chapter writing, consistency review, multi-format export',
        useCases: [
            'Generate detailed book outlines from a topic with chapter descriptions',
            'Write chapters progressively with continuity maintenance',
            'Review manuscripts for consistency, contradictions, repetition',
            'Export to Markdown, plain text, or HTML',
        ],
        keyExports: [
            { name: 'bookOutline', description: 'Generate detailed book outline with chapter descriptions and key points' },
            { name: 'bookWriteChapter', description: 'Write a chapter based on outline + previous content for continuity' },
            { name: 'bookReview', description: 'Review manuscript for consistency, contradictions, logic gaps' },
            { name: 'bookExport', description: 'Export manuscript to markdown/plain/html' },
        ],
        dependencies: ['@andy-toolforge/core'],
        skillFiles: true,
        skillPrefix: 'book-writing',
    },
    {
        name: '@andy-toolforge/pm-support',
        version: '1.0.2',
        description: 'Project management tools — task tracker, time tracking, invoices, reports',
        useCases: [
            'Track project tasks with status and assignment',
            'Log time entries per task for billing',
            'Generate invoices from tracked time',
            'Generate project management reports',
        ],
        keyExports: [
            { name: 'TaskTracker', description: 'Project management: tasks, time, reports, invoices' },
        ],
        dependencies: ['@andy-toolforge/core'],
        skillFiles: true,
        skillPrefix: 'pm-support',
    },
    {
        name: '@andy-toolforge/coding-support',
        version: '1.0.2',
        description: 'Code analysis tools — line counting, dead code detection, dependency graphs, complexity reports',
        useCases: [
            'Count lines of code matching glob patterns',
            'Detect potentially dead exports (modules not required from entry points)',
            'Generate dependency graphs of JS files in a project',
            'Analyze code complexity for specific files',
        ],
        keyExports: [
            { name: 'CodebaseAnalyzer', description: 'Line counts, dead code, dep graph, complexity' },
        ],
        dependencies: ['@andy-toolforge/core', 'fast-glob'],
        skillFiles: true,
        skillPrefix: 'coding-support',
    },
    {
        name: '@andy-toolforge/ba-support',
        version: '1.0.1',
        description: 'Business analysis support — competitor analysis, SWOT, pricing analysis, market trends, report generation',
        useCases: [
            'Analyze competitor websites (crawl, profile, strengths/weaknesses)',
            'Generate SWOT analysis from competitor profiles',
            'Analyze pricing data and generate strategic insights',
            'Analyze market trends for keywords (momentum, emerging patterns)',
            'Generate comprehensive business analysis reports',
        ],
        keyExports: [
            { name: 'competitorAnalysis', description: 'Analyze a competitor — crawl, profile, identify SW' },
            { name: 'swotAnalysis', description: 'Generate SWOT from competitor profiles' },
            { name: 'pricingAnalysis', description: 'Analyze pricing data for strategic insights' },
            { name: 'trendAnalysis', description: 'Analyze market trends for keywords' },
            { name: 'businessReport', description: 'Generate comprehensive business analysis report' },
        ],
        dependencies: ['@andy-toolforge/core'],
        skillFiles: true,
        skillPrefix: 'ba-support',
    },
    {
        name: '@andy-toolforge/voice-assistant',
        version: '0.1.0',
        description: 'AI voice assistant using Gemini Live API — bidirectional audio with built-in STT/TTS/function calling',
        useCases: [
            'Bounded voice conversations with AI via Gemini Live API',
            'Configure voice assistant with custom system prompt, voice, and tool definitions',
            'Domain-agnostic — works with any @andy-toolforge tool or custom tools',
        ],
        keyExports: [
            { name: 'voiceAssistantConfigure', description: 'Configure session settings (systemPrompt, voice, tools)' },
            { name: 'voiceAssistantSession', description: 'Start a bounded voice conversation with AI' },
        ],
        dependencies: ['@andy-toolforge/core', '@google/genai'],
        skillFiles: true,
        skillPrefix: 'voice-assistant',
    },
];

/**
 * Return the full ecosystem catalog, optionally filtered by search term.
 * @param {string} [search] — Case-insensitive search across name, description, keyExports, and useCases
 * @returns {object[]}
 */
function queryCatalog(search) {
    if (!search || !search.trim()) {
        return CATALOG.map(p => ({
            name: p.name,
            version: p.version,
            description: p.description,
            useCases: p.useCases,
            keyExports: p.keyExports.map(e => e.name),
            skillFiles: p.skillFiles,
        }));
    }

    const q = search.toLowerCase();
    return CATALOG
        .filter(p => {
            const name = p.name.toLowerCase();
            const desc = p.description.toLowerCase();
            const exports = p.keyExports.some(e => e.name.toLowerCase().includes(q) || e.description.toLowerCase().includes(q));
            const useCases = p.useCases.some(u => u.toLowerCase().includes(q));
            return name.includes(q) || desc.includes(q) || exports || useCases;
        })
        .map(p => ({
            name: p.name,
            version: p.version,
            description: p.description,
            useCases: p.useCases,
            keyExports: p.keyExports
                .filter(e => {
                    if (!q) return true;
                    return e.name.toLowerCase().includes(q) || e.description.toLowerCase().includes(q);
                })
                .map(e => e.name),
            skillFiles: p.skillFiles,
        }));
}

/**
 * Return full details for a single package.
 * @param {string} packageName — Full package name (e.g. '@andy-toolforge/footage-generation')
 * @returns {object|null}
 */
function getPackageDetails(packageName) {
    const pkg = CATALOG.find(p => p.name === packageName);
    if (!pkg) return null;

    return {
        name: pkg.name,
        version: pkg.version,
        description: pkg.description,
        useCases: pkg.useCases,
        keyExports: pkg.keyExports,
        dependencies: pkg.dependencies,
        providesSkillFiles: pkg.skillFiles,
        skillPrefix: pkg.skillPrefix || null,
    };
}

module.exports = { CATALOG, queryCatalog, getPackageDetails };
