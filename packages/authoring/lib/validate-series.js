'use strict';

const fs = require('fs');
const path = require('path');

/**
 * validateSeries — Validate a series directory structure and content.
 *
 * Checks:
 *  - Directory exists
 *  - 00-muc-luc.md present with metadata
 *  - All lesson files exist in order
 *  - Image references in lessons point to real files
 *  - Internal markdown links resolve
 *  - No orphaned/missing files
 *
 * @param {object} options
 * @param {string} options.seriesDir — Path to series directory
 * @returns {Promise<{ valid: boolean, errors: string[], warnings: string[], stats: object }>}
 */
async function validateSeries(options) {
    const { seriesDir } = options;

    if (!seriesDir) throw new Error('seriesDir is required');

    const errors = [];
    const warnings = [];

    // --- 1. Directory exists ---
    if (!fs.existsSync(seriesDir)) {
        return {
            valid: false,
            errors: [`Series directory does not exist: ${seriesDir}`],
            warnings: [],
            stats: { files: 0, lessons: 0, images: 0, validatedImages: 0, validLinks: 0, brokenLinks: 0 },
        };
    }
    if (!fs.statSync(seriesDir).isDirectory()) {
        return {
            valid: false,
            errors: [`Path is not a directory: ${seriesDir}`],
            warnings: [],
            stats: { files: 0, lessons: 0, images: 0, validatedImages: 0, validLinks: 0, brokenLinks: 0 },
        };
    }

    // --- List all files ---
    const allFiles = _listFiles(seriesDir);
    const mdFiles = allFiles.filter(f => f.endsWith('.md'));
    const imageFiles = allFiles.filter(f => /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(f));

    // --- 2. 00-muc-luc.md ---
    const tocFile = path.join(seriesDir, '00-muc-luc.md');
    if (!fs.existsSync(tocFile)) {
        errors.push('Missing 00-muc-luc.md (table of contents)');
    } else {
        const tocContent = fs.readFileSync(tocFile, 'utf-8');
        const tocMeta = _checkTocMetadata(tocContent);
        errors.push(...tocMeta.errors);
        warnings.push(...tocMeta.warnings);
    }

    // --- 3. Lesson files ---
    const lessonFiles = mdFiles
        .filter(f => path.basename(f) !== '00-muc-luc.md')
        .sort();

    // Check numbering consistency
    const numberPattern = /^(\d+)-/;
    let expectedNum = 1;
    for (const lf of lessonFiles) {
        const basename = path.basename(lf);
        const numMatch = basename.match(numberPattern);
        if (!numMatch) {
            warnings.push(`Lesson file does not follow NN-slug naming: ${basename}`);
            continue;
        }
        const num = parseInt(numMatch[1], 10);
        if (num !== expectedNum) {
            errors.push(`Lesson numbering gap: expected ${String(expectedNum).padStart(2, '0')}, got ${basename}`);
        }
        expectedNum = num + 1;
    }

    // --- 4. Image references ---
    let validatedImages = 0;
    let validLinks = 0;
    let brokenLinks = 0;

    const imgRefRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    for (const lf of lessonFiles) {
        const content = fs.readFileSync(lf, 'utf-8');
        let match;
        while ((match = imgRefRegex.exec(content)) !== null) {
            const refPath = match[2].trim();
            // Skip external URLs
            if (refPath.startsWith('http://') || refPath.startsWith('https://')) continue;
            // Skip placeholder references
            if (refPath.startsWith('placeholder:')) {
                warnings.push(`Unresolved image placeholder in ${path.basename(lf)}: ${match[1] || refPath}`);
                continue;
            }

            validatedImages++;
            const resolved = path.resolve(path.dirname(lf), refPath);
            if (fs.existsSync(resolved)) {
                validLinks++;
            } else {
                brokenLinks++;
                errors.push(`Image not found: ${refPath} (referenced in ${path.basename(lf)})`);
            }
        }
    }

    // --- 5. Internal link resolution ---
    const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
    for (const lf of lessonFiles) {
        const content = fs.readFileSync(lf, 'utf-8');
        let match;
        while ((match = linkRegex.exec(content)) !== null) {
            const refPath = match[2].trim();
            // Skip external URLs, image refs, anchors
            if (refPath.startsWith('http://') || refPath.startsWith('https://') || refPath.startsWith('#') || refPath.startsWith('placeholder:')) continue;

            const resolved = path.resolve(path.dirname(lf), refPath);
            if (!fs.existsSync(resolved)) {
                brokenLinks++;
                errors.push(`Broken link: ${refPath} (in ${path.basename(lf)})`);
            } else {
                validLinks++;
            }
        }
    }

    // --- Stats ---
    const stats = {
        files: allFiles.length,
        lessons: lessonFiles.length,
        images: imageFiles.length,
        validatedImages,
        validLinks,
        brokenLinks,
    };

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        stats,
    };
}

/**
 * List all files recursively in a directory.
 */
function _listFiles(dir) {
    const result = [];
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                // Skip node_modules, .git, hidden dirs
                if (!entry.name.startsWith('.')) {
                    result.push(..._listFiles(fullPath));
                }
            } else {
                result.push(fullPath);
            }
        }
    } catch {
        // skip unreadable dirs
    }
    return result;
}

/**
 * Check 00-muc-luc.md for required metadata.
 */
function _checkTocMetadata(content) {
    const errors = [];
    const warnings = [];

    // First line should be # Title
    const firstLine = content.trim().split('\n')[0];
    if (!firstLine || !firstLine.startsWith('# ')) {
        errors.push('00-muc-luc.md: missing title (# Title) on first line');
    }

    // Should have a lesson count
    const lessonCountMatch = content.match(/\*\*Số bài học\*\*:|Lessons:\*\*/);
    if (!lessonCountMatch) {
        warnings.push('00-muc-luc.md: missing lesson count metadata');
    }

    // Should have a date
    const dateMatch = content.match(/\*\*Ngày tạo\*\*:|Created:\*\*/);
    if (!dateMatch) {
        warnings.push('00-muc-luc.md: missing creation date metadata');
    }

    // Should have a table of contents section
    if (!content.includes('## Mục lục') && !content.includes('## Table of Contents')) {
        warnings.push('00-muc-luc.md: missing Table of Contents section');
    }

    return { errors, warnings };
}

module.exports = { validateSeries, _listFiles, _checkTocMetadata };
