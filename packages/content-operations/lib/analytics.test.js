const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const ContentAnalytics = require('./analytics');
const { ContentAnalyticsError } = require('./errors');

const mockLogger = { info: () => {}, warn: () => {}, error: () => {} };

describe('ContentAnalytics', async () => {
    let analytics;

    before(() => {
        analytics = new ContentAnalytics({ logger: mockLogger });
    });

    describe('constructor', async () => {
        await it('should create instance with defaults', () => {
            const a = new ContentAnalytics();
            assert.ok(a.logger);
        });
    });

    describe('generatePerformanceReport', async () => {
        await it('should return report for valid content IDs', async () => {
            const result = await analytics.generatePerformanceReport(
                ['content-1', 'content-2', 'content-3'],
                { start: '2026-01-01', end: '2026-06-30' }
            );
            assert.ok(Array.isArray(result.contentIds));
            assert.ok(result.metrics);
            assert.ok(typeof result.metrics.totalViews === 'number');
            assert.ok(Array.isArray(result.topPerformers));
        });

        await it('should throw for empty array', async () => {
            await assert.rejects(
                () => analytics.generatePerformanceReport([]),
                ContentAnalyticsError
            );
        });

        await it('should throw for non-array', async () => {
            await assert.rejects(
                () => analytics.generatePerformanceReport('not-array'),
                ContentAnalyticsError
            );
        });

        await it('should handle missing period', async () => {
            const result = await analytics.generatePerformanceReport(['id-1']);
            assert.ok(result.period.includes('30 days'));
        });
    });

    describe('identifyTrends', async () => {
        await it('should return trend analysis', async () => {
            const data = [
                { platform: 'youtube', views: 1000 },
                { platform: 'blog', views: 500 },
            ];
            const result = await analytics.identifyTrends(data);
            assert.ok(Array.isArray(result.trends));
            assert.ok(result.trends.length > 0);
        });

        await it('should handle empty data gracefully', async () => {
            const result = await analytics.identifyTrends([]);
            assert.equal(result.trends.length, 0);
            assert.ok(result.summary);
        });

        await it('should throw for non-array', async () => {
            await assert.rejects(
                () => analytics.identifyTrends('not-array'),
                ContentAnalyticsError
            );
        });
    });

    describe('generateInsights', async () => {
        await it('should return insights from report', async () => {
            const report = await analytics.generatePerformanceReport(['id-1']);
            const result = await analytics.generateInsights(report);
            assert.ok(Array.isArray(result.insights));
            assert.ok(result.topInsight);
        });

        await it('should throw for non-object report', async () => {
            await assert.rejects(
                () => analytics.generateInsights('not-object'),
                ContentAnalyticsError
            );
        });
    });

    describe('recommendOptimizations', async () => {
        await it('should return recommendations from insights', async () => {
            const report = await analytics.generatePerformanceReport(['id-1']);
            const insights = await analytics.generateInsights(report);
            const result = await analytics.recommendOptimizations(insights);
            assert.ok(Array.isArray(result.recommendations));
            assert.ok(result.recommendations.length > 0);
        });

        await it('should throw for non-object insights', async () => {
            await assert.rejects(
                () => analytics.recommendOptimizations('not-object'),
                ContentAnalyticsError
            );
        });

        await it('should throw for missing insights array', async () => {
            await assert.rejects(
                () => analytics.recommendOptimizations({ insights: 'not-array' }),
                ContentAnalyticsError
            );
        });
    });
});
