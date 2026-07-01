---
name: seo-video-podcast
description: Tối ưu SEO cho video podcast episode trên YouTube, TikTok, Facebook. Nhận tiêu đề + kịch bản, xuất title, description, tags, timestamps, hashtags theo từng platform. Dùng khi user upload podcast episode và cần metadata SEO cho từng nền tảng.
---

# SEO Cho Video Podcast Episode

Skill này hướng dẫn tối ưu SEO cho 1 episode podcast lên 3 nền tảng: YouTube, TikTok, Facebook.

## 📥 Input

- **Episode title** — tiêu đề tập
- **Script content** — kịch bản hoặc transcript đầy đủ
- **Target keywords** — (optional) từ khoá chính muốn rank
- **Series name** — tên series podcast

## 📤 Output

Mỗi platform nhận một bộ metadata riêng.

### YouTube

```text
Title: [tối đa 70 ký tự, keyword chính ở đầu]
Description: [200-500 ký tự, keyword trong 2 dòng đầu]
Tags: [5-10 tags, tag chính đầu tiên]
Hashtags: [3-5 hashtags, trong description]
Timestamps:
00:00 - Giới thiệu
01:23 - [Chủ đề chính]
...
```

### TikTok

```text
Caption: [100-150 ký tự, hook trong 3s đầu video]
Hashtags: [#tag1 #tag2 #tag3 #tag4 #tag5]
```

### Facebook

```text
Headline: [40-80 ký tự]
Description: [150-300 ký tự, kèm link preview]
Hashtags: [#tag1 #tag2 #tag3]
```

## 📐 Quy Tắc Chung

- **Keyword Placement:** Keyword chính xuất hiện trong 2 dòng đầu description YouTube, headline Facebook, caption TikTok.
- **Hashtags:** Tối đa 5 hashtag/platform. Không dùng hashtag trùng trên TikTok (dễ bị shadowban).
- **Timestamps:** Phải ≥3 mốc, format `MM:SS - Nội dung`. Mốc đầu tiên là `00:00 - Giới thiệu`.

## 🎯 Quy Tắc Riêng Từng Platform

### YouTube

- Title: keyword chính ở đầu, dưới 70 ký tự
- Description: 200-500 ký tự, tóm tắt nội dung + CTA (subscribe, comment)
- 3-5 hashtags cuối description
- Tags: 5-10 tags, tag chính đầu, không lặp hashtag
- Timestamps: 4-8 mốc, móc từ các transition trong script

### TikTok

- Caption ngắn 100-150 ký tự, hook mạnh nhất ở 3s đầu
- 3-5 trending hashtags liên quan + 1 hashtag thương hiệu
- Thêm câu hỏi tương tác cuối caption ("Bạn nghĩ sao?")

### Facebook

- Headline súc tích 40-80 ký tự, gây tò mò
- Description 150-300 ký tự, paragraph đầu là hook
- 2-3 hashtags
- Tối ưu link preview: dùng thumbnail tỷ lệ 1.91:1 (1200×628px)

## 📋 Template Output

```javascript
const youtube = {
  title: `[Keyword] — ${episodeTitle}`.slice(0, 70),
  description: `[Tóm tắt 2 câu với keyword]\n\n` +
    `[Nội dung chi tiết 3-5 câu]\n\n` +
    `⏱ Timestamps:\n00:00 - Giới thiệu\n${timestamps.join('\n')}\n\n` +
    `📌 Đừng quên đăng ký kênh để xem tập mới nhé!\n\n` +
    `#hashtag1 #hashtag2 #hashtag3`,
  tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'],
}
const tiktok = {
  caption: `[Hook 100-150 ký tự] Bạn nghĩ sao?`,
  hashtags: ['#tag1', '#tag2', '#tag3', '#tag4', '#tag5'],
}
const facebook = {
  headline: `[40-80 ký tự — tò mò]`,
  description: `[150-300 ký tự, paragraph đầu hook]`,
  hashtags: ['#tag1', '#tag2', '#tag3'],
}
```

## 📝 Ví Dụ

**Input:**
- Title: "Tư Duy Phản Biện — Cách Nhận Biết Tin Giả"
- Script: 45 phút, 3 chapter chính

**Output YouTube:**
```
Title: Tư Duy Phản Biện: 3 Cách Nhận Biết Tin Giả Trên MXH
Description:
Làm sao để không bị lừa bởi tin giả? Trong tập này, chúng ta phân tích
tư duy phản biện và 3 phương pháp kiểm chứng thông tin.

Nội dung chính:
- Tại sao não bộ dễ tin vào tin giả?
- 3 bước kiểm chứng thông tin
- Áp dụng trong đời sống hàng ngày

⏱ Timestamps:
00:00 - Giới thiệu
02:15 - Tại sao chúng ta dễ bị lừa?
15:30 - 3 bước kiểm chứng thông tin
38:45 - Áp dụng thực tế
42:00 - Tổng kết

📌 Đừng quên đăng ký kênh để xem tập mới nhé!

#TưDuyPhảnBiện #TinGiả #KỹNăngSống

Tags: tư duy phản biện, nhận biết tin giả, kỹ năng tư duy, podcast,
kiểm chứng thông tin, media literacy
```
