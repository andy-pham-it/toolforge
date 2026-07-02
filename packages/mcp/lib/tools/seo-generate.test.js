const assert = require('node:assert');
const { handler } = require('./seo-generate');

// Build 10 timestamps for testing
function buildTimestamps(count, prefix) {
    const timestamps = [];
    for (let i = 0; i < count; i++) {
        const minutes = String(Math.floor(i * 2.5)).padStart(2, '0');
        const seconds = String((i * 150) % 60).padStart(2, '0');
        timestamps.push({ time: `${minutes}:${seconds}`, label: `${prefix} segment ${i + 1}` });
    }
    return timestamps;
}

const fullMockResponse = {
    youtube: {
        suggestedTitle: 'YT SEO Title with Main Keyword',
        description: 'YouTube description with keyword-rich content. Covers all major points discussed in the video with detailed explanations.',
        formattedDescription: '📌 Content summary paragraph\n⏱️ Timestamps:\n00:00 - Intro\n02:30 - Main topic\n05:00 - Deep dive\n🔗 Links in description\n#SEO #Content',
        tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6', 'tag7', 'tag8', 'tag9', 'tag10', 'tag11', 'tag12'],
        keywords: ['keyword1', 'keyword2', 'keyword3', 'keyword4', 'keyword5', 'keyword6'],
        hashtags: ['#SEO', '#ContentMarketing', '#VideoTips', '#YouTubeSEO', '#ContentStrategy'],
        thumbnailText: 'Bold text overlay for YouTube thumbnail',
        thumbnailIdea: 'Split screen showing before/after with bold text overlay',
        hook: 'Are you making these SEO mistakes in your videos?',
        timestamps: buildTimestamps(10, 'YT'),
    },
    tiktok: {
        suggestedTitle: 'TikTok Hook That Stops Scrollers',
        description: 'TikTok caption with narrative hook and hashtag block.',
        formattedDescription: 'text hook paragraph\n#TikTok #Viral #ContentTips #SEO #MarketingTips #Growth #Strategy #Trending',
        tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6', 'tag7', 'tag8'],
        keywords: ['keyword1', 'keyword2', 'keyword3', 'keyword4', 'keyword5'],
        hashtags: ['#TikTok', '#Viral', '#ContentTips', '#SEO', '#MarketingTips', '#Growth', '#Strategy', '#Trending'],
        thumbnailText: 'Bold text for TikTok cover',
        thumbnailIdea: 'Close-up with attention-grabbing text overlay',
        hook: 'Stop scrolling — this one tip changes everything',
        timestamps: [],
    },
    facebook: {
        suggestedTitle: 'Facebook Shareable Video Title That Gets Clicks',
        description: 'Facebook post description with engagement hook and question to drive comments.',
        formattedDescription: '📌 Key takeaways:\n• Point one\n• Point two\n• Point three\n\nCTA: Share your thoughts below!\n#Facebook #VideoSEO',
        tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6', 'tag7', 'tag8', 'tag9', 'tag10'],
        keywords: ['keyword1', 'keyword2', 'keyword3', 'keyword4', 'keyword5', 'keyword6', 'keyword7', 'keyword8'],
        hashtags: ['#Facebook', '#VideoSEO', '#ContentStrategy', '#SocialMedia', '#MarketingTips'],
        thumbnailText: 'Facebook video thumbnail overlay text',
        thumbnailIdea: 'Bold text on gradient background with CTA overlay',
        hook: 'Which one of these applies to you? Comment below!',
        timestamps: buildTimestamps(8, 'FB'),
    },
    hashtagMatrix: {
        youtube: ['#SEO', '#ContentMarketing', '#VideoTips', '#YouTubeSEO', '#ContentStrategy', '#VideoMarketing', '#SEOTips', '#GrowYourChannel'],
        tiktok: ['#TikTok', '#Viral', '#ContentTips', '#SEO', '#MarketingTips', '#Growth', '#Strategy', '#Trending'],
        facebook: ['#Facebook', '#VideoSEO', '#ContentStrategy', '#SocialMedia', '#MarketingTips', '#VideoMarketing', '#Engagement', '#Reach'],
        crossPlatform: ['#ContentCreation', '#VideoMarketing', '#DigitalStrategy', '#OnlineMarketing', '#CreatorTips'],
    },
};

async function testSeoGenerate() {
    const result = await handler({ chat: async () => JSON.stringify(fullMockResponse) }, {
        script: 'test script for a 25-minute video covering multiple topics',
        title: 'test title',
    });

    // Core fields
    assert.strictEqual(result.youtube.suggestedTitle, 'YT SEO Title with Main Keyword');

    // Timestamps — YouTube should have 8-10, Facebook 6+
    assert.ok(result.youtube.timestamps.length >= 6, `YouTube timestamps: ${result.youtube.timestamps.length} (need >=6)`);
    assert.ok(result.facebook.timestamps.length >= 4, `Facebook timestamps: ${result.facebook.timestamps.length} (need >=4)`);

    // formattedDescription should contain \n
    assert.ok(result.youtube.formattedDescription.includes('\n'), 'YouTube formattedDescription should contain line breaks');
    assert.ok(result.facebook.formattedDescription.includes('\n'), 'Facebook formattedDescription should contain line breaks');

    // hashtagMatrix — all 4 arrays present
    assert.ok(result.hashtagMatrix, 'hashtagMatrix should exist');
    assert.ok(Array.isArray(result.hashtagMatrix.youtube), 'hashtagMatrix.youtube should be an array');
    assert.ok(Array.isArray(result.hashtagMatrix.tiktok), 'hashtagMatrix.tiktok should be an array');
    assert.ok(Array.isArray(result.hashtagMatrix.facebook), 'hashtagMatrix.facebook should be an array');
    assert.ok(Array.isArray(result.hashtagMatrix.crossPlatform), 'hashtagMatrix.crossPlatform should be an array');
    assert.ok(result.hashtagMatrix.youtube.length >= 5, `hashtagMatrix.youtube has ${result.hashtagMatrix.youtube.length} entries`);

    console.log('testSeoGenerate passed');
}

async function testIncompleteTimestamps() {
    const incomplete = {
        youtube: { suggestedTitle: 'YT', tags: ['t'], timestamps: [{ time: '00:00', label: 'Intro' }] },
        tiktok: { suggestedTitle: 'TT', tags: ['t'], timestamps: [] },
        facebook: { suggestedTitle: 'FB', tags: ['t'], timestamps: [{ time: '00:00', label: 'Intro' }] },
        hashtagMatrix: { youtube: ['#a'], tiktok: ['#b'], facebook: ['#c'], crossPlatform: ['#d'] },
    };
    await assert.rejects(
        () => handler({ chat: async () => JSON.stringify(incomplete) }, { script: 'test', title: 'Test' }),
        /timestamps insufficient/
    );
    console.log('testIncompleteTimestamps passed');
}

async function testMissingHashtagMatrix() {
    const noMatrix = {
        youtube: { suggestedTitle: 'YT', tags: ['t'], timestamps: buildTimestamps(8, 'YT') },
        tiktok: { suggestedTitle: 'TT', tags: ['t'], timestamps: [] },
        facebook: { suggestedTitle: 'FB', tags: ['t'], timestamps: buildTimestamps(6, 'FB') },
    };
    await assert.rejects(
        () => handler({ chat: async () => JSON.stringify(noMatrix) }, { script: 'test', title: 'Test' }),
        /hashtagMatrix/
    );
    console.log('testMissingHashtagMatrix passed');
}

testSeoGenerate().catch(err => { console.error(err); process.exit(1); });
testIncompleteTimestamps().catch(err => { console.error(err); process.exit(1); });
testMissingHashtagMatrix().catch(err => { console.error(err); process.exit(1); });
