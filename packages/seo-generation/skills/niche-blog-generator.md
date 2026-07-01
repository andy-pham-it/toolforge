---
name: niche-blog-generator
description: Tạo blog post cho niche website tối ưu Google SEO + affiliate marketing. Nhận keyword/chủ đề, xuất bài viết hoàn chỉnh với title, meta description, content, image prompts, internal links. Dùng khi cần content cho site kiếm tiền qua affiliate + AdSense.
---

# Niche Blog Generator — SEO + Affiliate

Sinh blog post hoàn chỉnh cho niche website, tối ưu Google SEO và tích hợp affiliate marketing tự nhiên.

## 📥 Input

- **Keyword / chủ đề** — từ khoá chính
- **Site context** — niche, đối tượng, domain
- **Existing posts** — (optional) danh sách bài đã có để internal linking
- **Affiliate links** — (optional) link sản phẩm cần chèn

## 📤 Output

```javascript
const blogPost = {
  slug: 'tieu-de-bai-viet',
  title: 'H1 với primary keyword — 50-65 ký tự',
  metaDescription: '150-160 ký tự, keyword + CTA',
  content: '# H1\n\n[2000-2500 từ body]\n\n## H2\n\n### H3\n\n...',
  imagePrompts: [
    { section: 'intro', prompt: '...' },
    { section: 'h2-1', prompt: '...' },
  ],
  internalLinks: [
    { text: 'anchor text', url: '/bai-lien-quan' },
  ],
  affiliateLinks: [
    { text: 'anchor text tự nhiên', url: 'affiliate-link', disclosure: true },
  ],
}
```

## 📐 Quy Tắc

### 1. Keyword Research (trước khi viết)

- **Search volume:** Chọn keyword có 100-1000 lượt/tháng (ít cạnh tranh)
- **Competition score:** Ưu tiên keyword có độ cạnh tranh thấp (DA đối thủ < 30)
- **Long-tail variations:** Tìm 3-5 long-tail từ keyword chính

```javascript
const keywordData = {
  primary: 'cách học tiếng Anh tại nhà',
  volume: 450,
  competition: 'low',
  longTail: [
    'cách học tiếng Anh tại nhà miễn phí',
    'lộ trình học tiếng Anh tại nhà cho người mới',
    'học tiếng Anh tại nhà hiệu quả không cần trung tâm',
  ],
}
```

### 2. Content Structure

```
H1: [Primary keyword] — 50-65 ký tự
  ├── H2: [Section với LSI keyword]
  │     ├── H3: [Sub-section]
  │     └── H3: [Sub-section]
  ├── H2: [Section]
  │     ├── H3: [Sub-section]
  │     └── H3: [Sub-section]
  └── H2: Kết luận + CTA
```

- H1 chứa primary keyword, là title chính xác
- Mỗi H2 là 1 ý lớn, có thể chứa LSI keyword
- Mỗi H3 là 1 khía cạnh của H2 đó
- **Paragraph ngắn:** 2-4 câu, tối đa 60 từ/paragraph

### 3. Word Count & Keyword Density

- **Tổng:** 1500-2500 từ
- **Primary keyword density:** 1-2% (15-25 lần trong 2000 từ)
- **LSI keywords:** 5-10 LSI keywords rải tự nhiên
- **Không nhồi nhét:** Keyword phải xuất hiện tự nhiên trong câu

### 4. Internal Linking

- Link đến 2-3 bài viết có sẵn trên cùng site
- Anchor text là keyword liên quan, không phải "click here"
- Mỗi bài chỉ link 1 lần đến cùng 1 bài khác
- Internal link ở phần nội dung chính, không phải ở đầu hay cuối

### 5. Affiliate Links

- **Chèn tự nhiên:** trong câu đề xuất, so sánh sản phẩm
- **Disclosure:** Luôn có `(*)` hoặc `(Đây là link affiliate)` ở gần link đầu tiên
- **Tỉ lệ:** 1-2 affiliate links / 1000 từ
- **Không spam:** Không chèn link vào H2, H3, hay đầu paragraph

```javascript
// Tốt — chèn tự nhiên:
'Sau 3 tháng thử nghiệm, mình thấy tai nghe A(*) là lựa chọn tốt nhất cho người mới.'

// Xấu — nhồi nhét:
'Mua tai nghe A ở đây: [link]. Mua tai nghe B ở đây: [link].'
```

### 6. Image Prompts

- Mỗi H2 có 1 image prompt
- Prompt bằng tiếng Anh, mô tả ảnh minh hoạ cho section đó
- Tỉ lệ: 16:9 ngang
- Phong cách: flat illustration, clean, modern

### 7. Meta Description

- 150-160 ký tự
- Chứa primary keyword
- Có CTA (lời kêu gọi click)
- Không trùng với H1

```
Học tiếng Anh tại nhà hiệu quả với lộ trình chi tiết 6 tháng.
Khám phá phương pháp, tài liệu miễn phí và mẹo tự học
giúp bạn giao tiếp thành thạo mà không cần đến trung tâm.
```

### 8. Affiliate Disclosure

Luôn thêm disclosure ở đầu hoặc cuối bài:

> (*) Bài viết có chứa link affiliate. Nếu bạn mua qua link này,
> mình nhận được một phần hoa hồng nhỏ — đó là cách bạn ủng hộ
> website này mà không tốn thêm chi phí.

## 📝 Ví Dụ

**Input:** "cách học tiếng Anh tại nhà", site về self-learning

**Output slug:** `hoc-tieng-anh-tai-nha-cho-nguoi-moi`

**Output title:** Cách Học Tiếng Anh Tại Nhà Cho Người Mới Bắt Đầu (Lộ Trình 6 Tháng)

**Output imagePrompts:**
- intro: `A clean flat illustration of a person studying English at a desk with books, headphones, and a laptop, cozy home environment, warm lighting, 16:9 aspect ratio, modern minimal style.`
- lo-trinh: `A 6-month roadmap illustration with milestones, study materials, and progress indicators, clean infographic style, pastel colors, 16:9 aspect ratio.`

**Output internalLinks:**
- `app học tiếng Anh miễn phí` → `/app-hoc-tieng-anh-mien-phi`
- `cách luyện nghe tiếng Anh` → `/cach-luyen-nghe-tieng-anh`
