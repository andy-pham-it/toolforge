'use strict';

/**
 * @andy-toolforge/authoring — Lesson/curriculum authoring tools.
 *
 * Exports:
 *   generateLesson       — Generate a lesson plan from topic + audience
 *   scaffoldSeries       — Create series directory structure with outline
 *   embedImagesToMarkdown — Replace image placeholders with generated images
 *   validateSeries       — Validate series structure, metadata, images, links
 */

const { generateLesson } = require('./generate-lesson');
const { scaffoldSeries } = require('./scaffold-series');
const { embedImagesToMarkdown } = require('./embed-images');
const { validateSeries } = require('./validate-series');

module.exports = {
    generateLesson,
    scaffoldSeries,
    embedImagesToMarkdown,
    validateSeries,
};
