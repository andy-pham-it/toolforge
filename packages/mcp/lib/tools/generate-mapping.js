/**
 * generate_mapping tool — Map background music and sound design to script segments.
 */
const definition = {
    name: 'generate_mapping',
    description: 'Map background music tracks and sound design elements to each script segment based on mood, pace, and content',
    inputSchema: {
        type: 'object',
        properties: {
            segments: {
                type: 'array',
                description: 'Array of segment objects from analyze_script or generate_prompts. Each must have title, summary, startTime, endTime',
                items: { type: 'object' },
            },
            mood: { type: 'string', description: 'Overall mood/theme (e.g. philosophical, dramatic, educational, inspirational)', default: 'philosophical' },
            language: { type: 'string', description: 'Language code', default: 'vi' },
        },
        required: ['segments'],
    },
};

const systemPrompt = `You are a music and sound design expert for podcast video production. Given script segments with titles, summaries, and timestamps, produce a music/sound mapping for each segment.

For each segment, recommend:
- A background music genre and subgenre that matches the mood
- A track energy level (low/medium/high)
- Suggested tempo range in BPM
- Instruments or sound elements that fit
- Optional: specific sound effects (SFX) for transitions or emphasis
- Whether the music should fade in, build up, or cut at boundaries

Return ONLY a valid JSON object with this exact structure:
{
  "overallVibe": "One-line description of the episode's audio identity",
  "tracks": [
    {
      "segmentId": 1,
      "segmentTitle": "...",
      "startTime": "00:00",
      "endTime": "04:30",
      "genre": "Ambient / Cinematic / Lo-fi / Electronic / Orchestral / etc.",
      "subgenre": "More specific descriptor",
      "energy": "low|medium|high",
      "bpm": 80,
      "instruments": ["piano pad", "subtle strings", "bass drone"],
      "moodKeywords": ["contemplative", "warm", "introspective"],
      "transition": "fade_in|crossfade|cut|build_up",
      "sfx": ["paper flip", "soft chime at 01:30"],
      "notes": "Production notes for this segment's audio"
    }
  ]
}`;

async function handler(llm, args) {
    const { segments, mood = 'philosophical', language = 'vi' } = args;

    if (!segments || !Array.isArray(segments) || segments.length === 0) {
        throw new Error('Missing required argument: segments (non-empty array)');
    }

    const userPrompt = [
        `Overall mood: ${mood}`,
        `Language: ${language}`,
        '',
        `Segments:`,
        JSON.stringify(segments.map(s => ({
            id: s.id,
            title: s.title || s.segmentTitle || s.name,
            summary: s.summary,
            startTime: s.startTime,
            endTime: s.endTime,
            visualStyle: s.visualStyle,
        })), null, 2),
    ].join('\n');

    const raw = await llm.chat(systemPrompt, userPrompt, true);
    const parsed = JSON.parse(raw);

    if (!parsed.tracks || !Array.isArray(parsed.tracks) || parsed.tracks.length === 0) {
        throw new Error('LLM returned empty tracks array');
    }

    return parsed;
}

module.exports = { definition, handler };
