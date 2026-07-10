# Podcast Visual Production

Tạo hình ảnh cho podcast episodes: từ script đến images + cover + BGM.

## Điều kiện tiên quyết

- Script podcast hoàn chỉnh (dạng text)
- Tiêu đề episode
- Output directory có quyền ghi file

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
  "segments": [...],   "outputDir": "./images"
})
```

> **Lưu ý:** `generate_batch_image` chạy background. Kiểm tra thư mục `outputDir` để xem tiến độ.
> Nếu cần sinh ảnh lại, chạy lại với `outputDir` mới để tránh ghi đè.

### Bước 5: Map BGM + sound design (optional)

```
skill_mcp(mcp_name="andy-toolforge", tool_name="generate_mapping", arguments={
  "segments": [...], "mood": "philosophical", "language": "vi"
})
```

## Tích hợp với các workflow khác

- **toolforge-podcast-voice-production**: Sau khi có images, tạo TTS audio cho cùng script
- **toolforge-podcast-content-strategy**: Dùng SEO metadata cho episode đã hoàn chỉnh
- **toolforge-podcast-project-manager**: Theo dõi tiến độ sản xuất visual

Pipeline đề xuất: Script → Visual (skill này) + Voice → SEO
