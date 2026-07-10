# Podcast Visual Production

Tạo hình ảnh cho podcast episodes: từ script đến images + cover + BGM.

## Workflow

### Bước 1: Phân tích script

```
skill_mcp(mcp_name="andy-toolforge", tool_name="analyze_script", arguments={
  "script": "...", "title": "...", "density": 2, "lang": "vi"
})
```

Kết quả: segments array (mỗi segment có title + summary + prompts).

### Bước 2: Sinh image prompts chi tiết (optional)

Nếu muốn kiểm soát nhiều hơn prompts, gọi `generate_prompts`:

```
skill_mcp(mcp_name="andy-toolforge", tool_name="generate_prompts", arguments={
  "script": "...", "title": "...", "language": "vi", "density": 5
})
```

### Bước 3: Thiết kế cover art

```
skill_mcp(mcp_name="andy-toolforge", tool_name="suggest_cover", arguments={
  "title": "...", "description": "...", "coverType": "all", "language": "vi"
})
```

### Bước 4: Batch generate images

```
skill_mcp(mcp_name="andy-toolforge", tool_name="generate_batch_image", arguments={
  "segments": [...], "outputDir": "./images"
})
```

### Bước 5: Map BGM + sound design (optional)

```
skill_mcp(mcp_name="andy-toolforge", tool_name="generate_mapping", arguments={
  "segments": [...], "mood": "philosophical", "language": "vi"
})
```
