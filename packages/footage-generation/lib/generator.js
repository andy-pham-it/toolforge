const { spawn } = require('child_process');
const path = require('path');

class ImageGenerator {
    static async generateBatch(promptsFilePath, outputDir) {
        return new Promise((resolve, reject) => {
            const scriptPath = path.join(__dirname, '../../_private/gemini-batch-generate.cjs');
            const process = spawn('node', [scriptPath, promptsFilePath, outputDir]);

            let output = '';
            process.stdout.on('data', (data) => {
                output += data.toString();
                console.log(`[GeminiGen]: ${data.toString().trim()}`);
            });

            process.stderr.on('data', (data) => {
                console.error(`[GeminiGen Error]: ${data.toString()}`);
            });

            process.on('close', (code) => {
                if (code === 0) resolve(output);
                else reject(new Error(`Gemini batch generation failed with code ${code}`));
            });
        });
    }
}

module.exports = ImageGenerator;
