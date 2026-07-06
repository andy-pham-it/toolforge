# TTS Generator Workflow

## When to use

Use this skill when you need to convert podcast/video scripts to voice audio. The TTS Generator handles:
- Smart script segmentation (LLM-based paragraph analysis)
- Multi-voice selection from 30 Gemini TTS voices
- Batch, single, or stream audio output

## Workflow

1. **Prepare script**: Full podcast script text with clear paragraph breaks
2. **Choose voice**: "auto" for smart selection, or pick from 30 voices (see tts-voice-selection skill)
3. **Run batch generation**: The tool segments and generates audio in parallel
4. **Assemble output**: Audio clips ready for final editing

## MCP Tools

- `generate_tts` — Full pipeline: script → segments → audio
- `list_tts_voices` — Browse available voices with descriptions

## Audio tags for expressiveness

Add comma-separated tags for emotional tone: determination, enthusiasm, excitement, curiosity, whispers, laughs, positive, neutral, negative, frustration, anger, amusement, awe, admiration
