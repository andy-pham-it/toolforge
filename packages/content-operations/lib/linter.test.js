const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const ContentPatternLinter = require('./linter');

describe('ContentPatternLinter', async () => {
    const linter = new ContentPatternLinter();
    const testDir = path.join(__dirname, 'test-files');

    // Helper to create a temporary markdown file
    const createTestFile = (fileName, content) => {
        if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
        const filePath = path.join(testDir, fileName);
        fs.writeFileSync(filePath, content, 'utf8');
        return filePath;
    };

    describe('audit', async () => {
        await it('should validate a correct sequence', () => {
            const content = `
## Outcomes
Some outcomes.
## Concept
Some concept.
## Content
Some content.
## Checklist
Some checklist.
## Appendix
Some appendix.
            `;
            const filePath = createTestFile('valid.md', content);
            const result = linter.audit(filePath);
            assert.strictEqual(result.isValid, true);
            assert.strictEqual(result.issues.length, 0);
        });

        await it('should detect missing sections', () => {
            const content = `
## Outcomes
Some outcomes.
## Concept
Some concept.
## Content
Some content.
## Appendix
Some appendix.
            `;
            // Missing 'Checklist'
            const filePath = createTestFile('missing.md', content);
            const result = linter.audit(filePath);
            assert.strictEqual(result.isValid, false);
            assert.ok(result.issues.some(i => i.includes('Missing required section: Checklist')));
        });

        await it('should detect out-of-order sections', () => {
            const content = `
## Appendix
Some appendix.
## Outcomes
Some outcomes.
## Concept
Some concept.
## Content
Some content.
## Checklist
Some checklist.
            `;
            const filePath = createTestFile('out-of-order.md', content);
            const result = linter.audit(filePath);
            assert.strictEqual(result.isValid, false);
            assert.ok(result.issues.some(i => i.includes('out of order')));
        });

        await it('should be case-insensitive and handle partial matches', () => {
            const content = `
## MY OUTCOMES
Some outcomes.
## THE CONCEPT
Some concept.
## MAIN CONTENT
Some content.
## FINAL CHECKLIST
Some checklist.
## ADDITIONAL APPENDIX
Some appendix.
            `;
            const filePath = createTestFile('partial.md', content);
            const result = linter.audit(filePath);
            assert.strictEqual(result.isValid, true);
        });
    });

    describe('suggest', async () => {
        await it('should return success message for valid result', () => {
            const result = { isValid: true, filePath: 'valid.md', issues: [] };
            const suggestions = linter.suggest(result);
            assert.strictEqual(suggestions, 'No fixes needed. Content follows the required pattern.');
        });

        await it('should return helpful suggestions for invalid result', () => {
            const result = { 
                isValid: false, 
                filePath: 'invalid.md', 
                issues: ['Missing required section: Checklist'] 
            };
            const suggestions = linter.suggest(result);
            assert.ok(suggestions.includes('Fixes for invalid.md:'));
            assert.ok(suggestions.includes('- Missing required section: Checklist'));
            assert.ok(suggestions.includes('Recommended sequence:'));
        });
    });
});
