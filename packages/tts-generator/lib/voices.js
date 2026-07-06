/**
 * @andy-toolforge/tts-generator — Gemini TTS Voice Definitions
 *
 * All 30 prebuilt Gemini TTS voices with style and description.
 * See: https://ai.google.dev/gemini-api/docs/interactions/speech-generation
 */

/** @type {Record<string, { style: string, description: string }>} */
const VOICES = {
    Zephyr:         { style: "Bright",        description: "Energetic, positive — great for introductions and upbeat content" },
    Puck:           { style: "Upbeat",         description: "Playful, lively — good for light-hearted segments" },
    Charon:         { style: "Informative",    description: "Educational, calm — ideal for explanatory narration" },
    Kore:           { style: "Firm",           description: "Assertive, authoritative — strong for persuasive content" },
    Fenrir:         { style: "Excitable",      description: "Passionate, enthusiastic — high-energy delivery" },
    Leda:           { style: "Youthful",       description: "Fresh, young — good for casual/younger audience" },
    Orus:           { style: "Firm",           description: "Steady, grounded — similar to Kore with warmer tone" },
    Aoede:          { style: "Breezy",         description: "Light, airy — effortless narration style" },
    Callirrhoe:     { style: "Easy-going",     description: "Relaxed, conversational — natural dialogue feel" },
    Autonoe:        { style: "Bright",         description: "Radiant, clear — similar to Zephyr with softer edge" },
    Enceladus:      { style: "Breathy",        description: "Intimate, close — good for emotional/personal segments" },
    Iapetus:        { style: "Clear",          description: "Crisp, precise — excellent for technical content" },
    Umbriel:        { style: "Easy-going",     description: "Laid-back, unhurried — slow-paced narration" },
    Algieba:        { style: "Smooth",         description: "Velvety, polished — luxurious listening experience" },
    Despina:        { style: "Smooth",         description: "Silky, flowing — seamless narration flow" },
    Erinome:        { style: "Clear",          description: "Bright-clear hybrid — articulate with warmth" },
    Algenib:        { style: "Gravelly",       description: "Raspy, textured — distinctive character voice" },
    Rasalgethi:     { style: "Informative",    description: "Deep, knowledgeable — authoritative explainer" },
    Laomedeia:      { style: "Upbeat",         description: "Bouncy, cheerful — energetic short segments" },
    Achernar:       { style: "Soft",           description: "Gentle, whispery — quiet introspective moments" },
    Alnilam:        { style: "Firm",           description: "Bold, commanding — strong narrative presence" },
    Schedar:        { style: "Even",           description: "Balanced, neutral — consistent all-purpose voice" },
    Gacrux:         { style: "Mature",         description: "Seasoned, wise — older authoritative tone" },
    Pulcherrima:    { style: "Forward",        description: "Direct, engaging — keeps listener attention" },
    Achird:         { style: "Friendly",       description: "Warm, approachable — like a trusted friend" },
    Zubenelgenubi:  { style: "Casual",         description: "Informal, everyday — relaxed conversation" },
    Vindemiatrix:   { style: "Gentle",         description: "Tender, soothing — calming narration" },
    Sadachbia:      { style: "Lively",         description: "Spirited, animated — lively storytelling" },
    Sadaltager:     { style: "Knowledgeable",  description: "Well-informed, measured — expert narrator" },
    Sulafat:        { style: "Warm",           description: "Rich, inviting — classic storytelling warmth" },
};

/** @type {string[]} */
const VOICE_NAMES = Object.keys(VOICES);

/**
 * Get voice metadata by name (case-insensitive).
 * @param {string} name
 * @returns {{ style: string, description: string } | null}
 */
function getVoice(name) {
    const match = VOICE_NAMES.find(v => v.toLowerCase() === name.toLowerCase());
    return match ? VOICES[match] : null;
}

/**
 * Pick a voice appropriate for the given content tone.
 * @param {'informative' | 'upbeat' | 'calm' | 'authoritative' | 'friendly'} tone
 * @returns {string} Voice name
 */
function pickVoiceForTone(tone) {
    const map = {
        informative:    ['Charon', 'Iapetus', 'Sadaltager'],
        upbeat:         ['Zephyr', 'Puck', 'Laomedeia'],
        calm:           ['Callirrhoe', 'Umbriel', 'Vindemiatrix'],
        authoritative:  ['Kore', 'Orus', 'Alnilam'],
        friendly:       ['Achird', 'Sulafat', 'Despina'],
    };
    const candidates = map[tone] || map.informative;
    return candidates[Math.floor(Math.random() * candidates.length)];
}

module.exports = { VOICES, VOICE_NAMES, getVoice, pickVoiceForTone };
