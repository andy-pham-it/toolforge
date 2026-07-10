# Toolforge MCP Bridge

Kết nối agent với @andy-toolforge ecosystem thông qua MCP protocol.
Gọi bất kỳ tool nào trong 34 tools qua `skill_mcp`.

## MCP Server

Server name: `andy-toolforge` (khai báo trong opencode.json)

## Cách dùng

```
skill_mcp(mcp_name="andy-toolforge", tool_name="<tool>", arguments={...})
```

## Tools

### Visual Production
| Tool | Mô tả |
|------|-------|
| `analyze_script` | Phân tích script → visual segments + prompts |
| `generate_prompts` | 5 image prompts/segment (5 visual styles) |
| `generate_mapping` | Map BGM + sound design per segment |
| `suggest_cover` | Cover art (series/episode/thumbnail) |
| `generate_batch_image` | Batch generate images từ segments |

### SEO
| Tool | Mô tả |
|------|-------|
| `toolforge_seo_generate` | SEO metadata cho YouTube/TikTok/Facebook |

### Content Research
| Tool | Mô tả |
|------|-------|
| `andy_toolforge_content_summarizer` | Summarize articles/reports |
| `andy_toolforge_content_ideator` | Generate content ideas |
| `andy_toolforge_article_manager` | Classify, tag, summarize articles |
| `andy_toolforge_competitor_analyzer` | Crawl + LLM phân tích competitor |

### Content Operations
| Tool | Mô tả |
|------|-------|
| `toolforge_content_research` | Research trends, keywords, gaps |

### Business Analysis
| Tool | Mô tả |
|------|-------|
| `toolforge_competitor_analysis` | Crawl + profile competitor |
| `toolforge_pricing_analysis` | Phân tích pricing |
| `toolforge_swot_analysis` | SWOT từ competitor data |
| `toolforge_trend_analysis` | Market trends |
| `toolforge_business_report` | Business reports |

### Book Writing
| Tool | Mô tả |
|------|-------|
| `toolforge_book_outline` | Book outline từ topic |
| `toolforge_book_write_chapter` | Viết chapter với continuity |
| `toolforge_book_review` | Review manuscript |
| `toolforge_book_export` | Export (markdown/plain/html) |

### Project Management
| Tool | Mô tả |
|------|-------|
| `pm_create_project` | Tạo project |
| `pm_add_task` | Thêm task |
| `pm_track_time` | Track time |
| `pm_generate_report` | Generate report |
| `pm_calculate_invoice` | Tính invoice |

### TTS & Voice
| Tool | Mô tả |
|------|-------|
| `generate_tts` | Text-to-speech (Gemini TTS) |
| `list_tts_voices` | Danh sách 30 voices |
| `voice_assistant_session` | Voice conversation session |
| `voice_assistant_configure` | Cấu hình voice assistant |

### Code Analysis
| Tool | Mô tả |
|------|-------|
| `codebase_line_counts` | Count lines of code |
| `codebase_dead_code` | Find dead exports |
| `codebase_dependency_graph` | Dependency graph |
| `codebase_complexity` | Complexity report |

### Router
| Tool | Mô tả |
|------|-------|
| `toolforge_suggest` | Mô tả task → gợi ý tool phù hợp |
