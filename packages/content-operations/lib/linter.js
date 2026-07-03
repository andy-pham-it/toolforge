const fs = require('fs');
const path = require('path');

class ContentPatternLinter {
    constructor() {
        this.requiredSequence = [
            'Outcomes',
            'Concept',
            'Content',
            'Checklist',
            'Appendix'
        ];
    }

    /**
     * Audits a markdown file for the required content sequence.
     * @param {string} filePath Path to the markdown file.
     * @returns {Object} Audit results containing status and missing/out-of-order sections.
     */
    audit(filePath) {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        const foundHeaders = [];

        // Find all H2 headers
        const headerRegex = /^##\s+(.+)$/;
        for (const line of lines) {
            const match = line.match(headerRegex);
            if (match) {
                foundHeaders.push(match[1].trim());
            }
        }

        const issues = [];
        let lastIndex = -1;

        for (const section of this.requiredSequence) {
            const index = foundHeaders.findIndex(h => h.toLowerCase().includes(section.toLowerCase()));
            if (index === -1) {
                issues.push(`Missing required section: ${section}`);
            } else if (index < lastIndex) {
                issues.push(`Section ${section} is out of order (should come after previous required sections)`);
            }
            lastIndex = index;
        }

        return {
            filePath,
            isValid: issues.length === 0,
            issues: issues
        };
    }

    /**
     * Suggests fixes for the audit issues.
     * @param {Object} auditResult Result from the audit method.
     * @returns {string} Suggestions for fixing the issues.
     */
    suggest(auditResult) {
        if (auditResult.isValid) {
            return 'No fixes needed. Content follows the required pattern.';
        }

        let suggestions = `Fixes for ${auditResult.filePath}:\n`;
        auditResult.issues.forEach(issue => {
            suggestions += `- ${issue}\n`;
        });
        suggestions += '\nRecommended sequence: Outcomes -> Concept -> Content -> Checklist -> Appendix';
        
        return suggestions;
    }
}

module.exports = ContentPatternLinter;
