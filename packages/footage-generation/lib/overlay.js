const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

class TextOverlayer {
    static async applyCoverText(folderPath, title, subtitle = '') {
        const coverPath = path.join(folderPath, 'cover_series.png');
        if (!fs.existsSync(coverPath)) {
            throw new Error('cover_series.png not found for overlay');
        }

        const image = sharp(coverPath);
        const metadata = await image.metadata();
        const { width, height } = metadata;

        // Create an SVG overlay for the text
        // We use SVG because it allows for better typography and glow effects
        const svg = `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="5" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <linearGradient id="grad" x1="0%" y1="100%" x2="0%" y2="0%">
                    <stop offset="0%" style="stop-color:black; stop-opacity:0.8" />
                    <stop offset="100%" style="stop-color:black; stop-opacity:0" />
                </linearGradient>
            </defs>
            
            <!-- Background Gradient for readability -->
            <rect x="0" y="${height * 0.6}" width="${width}" height="${height * 0.4}" fill="url(#grad)" />

            <!-- Main Title -->
            <text x="50%" y="${height * 0.65}" 
                  text-anchor="middle" 
                  fill="white" 
                  font-family="serif" 
                  font-weight="bold" 
                  font-size="${Math.floor(width * 0.035)}" 
                  filter="url(#glow)"
                  style="text-transform: uppercase;">
                ${title}
            </text>

            <!-- Subtitle -->
            <text x="50%" y="${height * 0.75}" 
                  text-anchor="middle" 
                  fill="#d1d5db" 
                  font-family="serif" 
                  font-size="${Math.floor(width * 0.015)}" 
                  style="letter-spacing: 2px;">
                ${subtitle}
            </text>
        </svg>
        `;

        const svgBuffer = Buffer.from(svg);
        
        const outputPath = path.join(folderPath, 'cover_series_with_title.png');
        await image
            .composite([{ input: svgBuffer, top: 0, left: 0 }])
            .toFile(outputPath);
    }
}

module.exports = TextOverlayer;
