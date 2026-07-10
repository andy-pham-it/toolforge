---
name: content-arbitrage
description: Biến 1 nội dung gốc thành nhiều format cho nhiều platform. Nhận 1 bài viết/kịch bản, xuất blog post + Twitter thread + TikTok script + Facebook/LinkedIn post. Dùng khi cần tối đa hoá reach từ 1 nội dung duy nhất.
---

# Content Arbitrage — 1 Nguồn → Nhiều Platform

Biến 1 nội dung gốc (blog, script podcast, video transcript) thành 4 format riêng biệt, mỗi format tối ưu cho 1 platform.

## 📥 Input

- **Source content** — bài viết gốc hoặc transcript (1000+ từ)
- **Target platform list** — mặc định: Blog + Twitter + TikTok + Facebook/LinkedIn
- **Brand voice notes** — (optional) giọng văn mong muốn

## 📤 Output

### Blog Post (2000+ từ)
```markdown
# [H1 với primary keyword]

[Hook paragraph — 2-3 câu]

## [H2 — Section 1]
### [H3 — Subsection]
Nội dung...

## [H2 — Section 2]
...

## Kết luận + CTA
```

### Twitter Thread
```
1/ [Hook tweet — ≤280 ký tự] 🧵

2/ [Điểm chính 1 — ≤280 ký tự]

3/ [Điểm chính 2 — ≤280 ký tự]

...

8/ [Tổng kết + link blog/CTA — ≤280 ký tự]
```

### TikTok Script (60-90s)
```markdown
⏱ 0:00-0:05 Hook (pattern interrupt)
⏱ 0:05-0:45 Nội dung chính (3 điểm)
⏱ 0:45-0:55 Ví dụ / minh hoạ
⏱ 0:55-1:00 CTA + kêu gọi comment
```

### Facebook / LinkedIn Post
```markdown
[150-300 từ, professional tone, engagement question cuối]
```

## 📐 Quy Tắc

### Blog (dài nhất, đầy đủ nhất)
- 2000+ từ, H1→H2→H3 hierarchy
- Primary keyword trong H1 và 2-3 lần trong body
- Internal link đến 2-3 bài khác
- Featured image prompt ở đầu
- Paragraph ngắn (2-4 câu), dễ đọc trên mobile

### Twitter Thread
- Hook tweet + 5-10 reply tweets
- Mỗi tweet ≤280 ký tự (đếm cả số thứ tự + dấu cách)
- Đánh số: `1/`, `2/`, `3/`, ...
- Tweet cuối: link đến blog + CTA
- Cách 1 dòng giữa các tweet, không cách giữa số và nội dung

### TikTok Script
- 60-90 giây
- 3s đầu: pattern interrupt (câu hỏi, sốc, tò mò)
- Giữa: 3 điểm chính, mỗi điểm 15-20s
- Pattern interrupt giữa các điểm (đổi góc quay, âm thanh)
- Cuối: CTA cụ thể ("Follow để xem phần 2", "Comment số 1 nếu bạn đồng ý")

### Facebook / LinkedIn
- Professional nhưng gần gũi, không formal quá
- 150-300 từ
- Paragraph đầu là hook
- Câu hỏi tương tác cuối bài
- LinkedIn: thêm 3-5 hashtags ngành
- Facebook: thẻ tag bạn bè (optional)

### Tone of Voice Theo Platform

| Platform | Tone | Độ dài | Format |
|----------|------|--------|--------|
| Blog | Chuyên sâu, tin cậy | 2000+ từ | Markdown |
| Twitter | Gần gũi, gây tò mò | 280 ký tự/tweet | Thread đánh số |
| TikTok | Tự nhiên, năng lượng cao | 60-90s | Script timing |
| LinkedIn | Chuyên nghiệp, chia sẻ kiến thức | 150-300 từ | Paragraph |
| Facebook | Câu chuyện, cảm xúc | 150-300 từ | Paragraph + ảnh |

## 📝 Ví Dụ

**Input:** Podcast transcript 45' về "AI trong giáo dục"

**Blog title:** Ứng Dụng AI Trong Giáo Dục: 5 Cách Cải Thiện Trải Nghiệm Học Tập

**Twitter Thread:**
```
1/ AI không thay thế giáo viên — nhưng giáo viên biết dùng AI sẽ thay thế giáo viên không biết. 🧵

2/ 5 cách AI đang thay đổi lớp học ngay bây giờ:
   • Cá nhân hoá lộ trình học
   • Chấm bài tự động
   • Tutor ảo 24/7
   • Tạo nội dung giảng dạy
   • Phân tích dữ liệu học tập

3/ Cá nhân hoá: AI phân tích điểm yếu từng học sinh → tự động đề xuất bài tập phù hợp. Kết quả: học sinh tiến bộ nhanh hơn 37%...

8/ Muốn tìm hiểu thêm? Đọc full bài blog ở link bio. Bạn đã thử dùng AI trong học tập chưa?
```

**TikTok Script:**
```
⏱ 0:00-0:03: "Bạn có biết 37% học sinh tiến bộ nhanh hơn nhờ AI?"
⏱ 0:03-0:20: Giới thiệu 5 cách AI trong giáo dục
⏱ 0:20-0:45: Ví dụ cụ thể: tutor ảo, chấm bài tự động
⏱ 0:45-0:55: Minh hoạ: ảnh so sánh lớp học có AI vs không AI
⏱ 0:55-1:00: Follow để xem phần 2 về công cụ AI miễn phí!
```

## 📥 Prerequisites

- Source content — blog post, podcast transcript, hoặc video script (1000+ từ)
- (Optional) Target platform list — mặc định: Blog + Twitter + TikTok + Facebook/LinkedIn
- (Optional) Brand voice notes — giọng văn mong muốn

## 🚨 Error Recovery

- Source content quá ngắn (< 500 từ) → khó repurpose thành nhiều format. Cần mở rộng content trước
- Platform-specific constraints (Twitter 280 ký tự) → kiểm tra độ dài output, trim nếu cần
- LLM sinh content không đúng platform tone → thêm brand voice notes hoặc platform-specific examples

## 🔗 Integration

- **MCP tool:** Không có MCP tool trực tiếp (skill này là template cho agent tự repurpose)
- Input content có thể từ `andy_toolforge_content_summarizer` (content-research) để tóm tắt trước
- Output blog có thể dùng làm input cho `toolforge_seo_generate` (seo-generation) để tối ưu SEO
- Kết quả có thể feed vào `content-research-article-manager` để classify và manage

## 📚 Related Skills

- `seo-generation-video-podcast` — SEO cho episodes
- `seo-generation-niche-blog-generator` — tạo blog posts từ keyword
- `seo-generation-hub` — tổng quan tools seo-generation
