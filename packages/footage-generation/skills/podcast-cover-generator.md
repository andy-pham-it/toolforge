---
name: podcast-cover-generator
description: Generate series cover, chapter cover, and episode cover images for podcast visual production. Trigger when the user asks for a cover image, chapter cover, series thumbnail, episode artwork, or when the podcast-processor workflow delegates cover creation. Use this skill whenever an outline or chapter list is available alongside a podcast script — do NOT generate covers inside podcast-processor; defer to this skill. Supports multiple visual styles (Surrealist, Comparison, Symbolic, Typography, Cosmic, Lineart, Mirror/Reflection) and adapts to each chapter's theme.
---

# Podcast Cover Generator

Skill chuyên tạo prompt cho **cover ảnh** (series cover + chapter cover + episode cover) cho sản xuất video podcast. Không dùng skill này để tạo scene prompts cho timeline video — việc đó thuộc về `podcast-processor`.

## 📥 Input

Skill này cần ít nhất một trong các dữ liệu sau:
- **Outline series** — danh sách chương (chapter title + mô tả ngắn)
- **Tiêu đề tập / series**
- **Theme chính** của series hoặc chapter
- **Kịch bản** của chapter đó (nếu có)

## 📤 Output

Một hoặc nhiều file markdown chứa prompt, đặt trong thư mục tập podcast (slug), với format tương thích với batch-generator script.

## 🗂️ Naming Convention

| Loại | Tên file | Ghi chú |
|---|---|---|
| Series cover | `cover_series.png` | Ảnh đại diện toàn series |
| Chapter cover | `chapter[N]_cover.png` | `N` = số thứ tự chương |
| Episode cover | `cover_episode.png` | Dùng nếu chỉ có 1 episode không chia chapter |
| Thumbnail | `thumbnail.png` | Ảnh social media / YouTube thumbnail |

Tất cả đều tỷ lệ **ngang 16:9**.

## 🎨 Quy tắc Prompt Chung

* Không dùng tham số code (`--ar`, `--no`, `--style`).
* Tỷ lệ ngang 16:9 → thêm câu `The image has a horizontal 16:9 aspect ratio.`
* Tạo khoảng tối (dark space) phía trên và dưới ảnh để overlay text (chapter title, episode number...). Mô tả rõ trong prompt.
* ⛔ **TUYỆT ĐỐI TRÁNH photorealistic humans.** Không mô tả nhân vật nổi tiếng, chân dung giống người thật. Luôn dùng: `silhouette`, `shadow figure`, `stylized outline`, `abstract figure`, `artistic sketch`. Nếu cần thể hiện nhân vật lịch sử → dùng `painting-style`, `woodcut illustration`, `vintage engraving`.
* Yếu tố cần tránh → viết thành câu phủ định ở cuối prompt (ví dụ: `Avoid clichéd sci-fi aesthetics. Avoid literal robot faces.`).
* Nếu ảnh có text → thêm `All text and labels in this image must be written in [ngôn ngữ].` ở cuối.
* Giữ tông painterly, contemplative, artistic — tránh ảnh trông như stock photo.

## 🎯 Chọn Visual Style Cho Cover

Không mặc định là Comparison. Phân tích nội dung chapter/series để chọn style phù hợp nhất:

### Surrealist
**Khi nào dùng:** Nội dung triết lý sâu sắc, trừu tượng, câu hỏi về bản thể, identity, consciousness.
**Đặc trưng:** Cảnh mơ hồ, floating objects, dimension-bending, metaphor hình ảnh, ánh sáng dramatic, painterly.
**Ví dụ chúng ta đã làm:** Series cover với mirror + brain circuit + cosmic background.

### Comparison
**Khi nào dùng:** Chapter có sự đối lập rõ rệt — cũ vs. mới, ảo tưởng vs. thực tế, trước vs. sau.
**Đặc trưng:** Split composition (trái/phải hoặc trên/dưới), hai nửa tương phản về màu sắc + ánh sáng, đường phân cách ở giữa (vết nứt, rìa sáng, đường kẻ).
**Kỹ thuật:** Nửa ấm và nửa lạnh, silhouette ở cả hai bên, dùng đường nứt/phân cách làm focal point chính giữa.
**Lưu ý:** Tránh lạm dụng — chỉ dùng khi nội dung thực sự có tính đối lập.

### Symbolic / Iconic
**Khi nào dùng:** Chapter có một concept trung tâm mạnh — một biểu tượng duy nhất đại diện cho toàn bộ chương.
**Đặc trưng:** Một object/symbol lớn ở trung tâm, nền tối thiểu, ánh sáng tập trung vào symbol. Minimalist, powerful.
**Ví dụ:** Một câu hỏi khổng lồ làm từ sao, một bộ não bằng mạch điện, một chiếc gương vỡ.

### Cosmic
**Khi nào dùng:** Chapter nói về vũ trụ, scale, vị trí của con người trong không gian, Pale Blue Dot, Copernican shock.
**Đặc trưng:** Deep space, tiny Earth/Pale Blue Dot, human silhouette nhỏ bé, scale tương phản giữa vastness và smallness, cold deep-blue tones.
**Kỹ thuật:** Human silhouette nhỏ xíu nhìn lên bầu trời sao, hoặc một chấm xanh lơ lửng giữa khoảng không.

### Typography
**Khi nào dùng:** Chapter có một câu quote/câu hỏi trung tâm cực mạnh — dùng text làm visual chính.
**Đặc trưng:** Chữ lớn làm chủ đạo, được integrate vào cảnh (chữ làm từ sao, từ smoke, từ circuit patterns), không chỉ đơn thuần là text overlay.
**Lưu ý:** Luôn thêm language instruction ở cuối prompt.

### Lineart
**Khi nào dùng:** Chapter đơn giản, hiện đại, liên quan AI/công nghệ, muốn tối giản.
**Đặc trưng:** Clean lines, minimal color palette (thường trắng đen hoặc 1-2 màu), geometric shapes, negative space.

### Mirror / Reflection
**Khi nào dùng:** Chapter xoay quanh self-reflection, identity, "Tôi là ai?", introspection.
**Đặc trưng:** Gương, mặt nước, bề mặt phản chiếu, hình ảnh nhân đôi, đối xứng.
**Lưu ý:** Phản chiếu nên là stylized/abstract, không phải khuôn mặt người thật.

> ⚠️ **Nguyên tắc chọn style:** Một chapter có thể phù hợp nhiều style — ưu tiên style thể hiện được **bản chất** của chapter nhất. Nếu phân vân, chọn Surrealist hoặc Symbolic làm default an toàn.

## 📋 Quy trình Làm Việc

### Bước 1: Đọc Input
- Nếu có file `outline.md` trong thư mục tập → đọc để lấy danh sách chapter title + theme.
- Nếu không có outline → hỏi user hoặc suy ra từ tiêu đề tập.

### Bước 2: Xác Định Danh Sách Cover Cần Tạo
- Luôn tạo **series cover** (`cover_series.png`) — ảnh tổng quát, đại diện cho toàn bộ series.
- Nếu có outline → tạo thêm **chapter cover** cho từng chapter (`chapter1_cover.png`, `chapter2_cover.png`, ...).

### Bước 3: Chọn Visual Style Cho Từng Cover
- Với mỗi cover, phân tích nội dung và chọn style phù hợp (xem bảng ở trên).
- **Series cover:** Thường là Surrealist hoặc Symbolic — ảnh tổng quát nhất.
- **Chapter cover:** Style tùy theo nội dung cụ thể của chapter đó — có thể khác nhau giữa các chapter.
- **Không ép tất cả chapter vào cùng một style.**

### Bước 4: Viết Prompt
Áp dụng tất cả quy tắc chung (mục 🎨). Cấu trúc prompt gồm:
1. **Mô tả composition** — bố cục tổng thể, góc nhìn
2. **Chi tiết trung tâm** — symbol, nhân vật, object chính
3. **Background & atmosphere** — không gian, màu sắc, ánh sáng
4. **Mood & style cues** — painterly, contemplative, epic, mysterious...
5. **Text overlay space** — khoảng tối trên/dưới
6. **Aspect ratio** — 16:9
7. **Exclusions** — câu phủ định ở cuối
8. **Language instruction** — nếu ảnh có text

### Bước 5: Tạo File Prompt
Tạo file markdown riêng cho cover prompts (ví dụ: `prompts-covers.md`) với format:

    # DANH SÁCH PROMPT - COVERS
    ### 📌 Phân cảnh 1: Series Cover
    * **Tên file ảnh:** `cover_series.png`
    * **🚀 Prompt tạo ảnh:**
    ```text
    [Prompt hoàn chỉnh]
    ```

**Lưu ý format heading:** Script batch parser yêu cầu đúng `### 📌 Phân cảnh N:` (có số thứ tự N). Mỗi cover là một phân cảnh riêng.

## 🔗 Tích Hợp Với Workflow Chính

Skill này được gọi từ `podcast-processor` (xem section 4 của skill đó). Luồng:

```
podcast-processor tạo prompts.md xong
    → gọi podcast-cover-generator với outline
    → tạo prompts-covers.md
    → gemini-batch-generate chạy cả 2 file
```

## 📚 Tham Khảo

- `workflow-podcast-processor.md` — skill chính xử lý kịch bản + scene prompts
- `batch-image-generator` — skill sinh ảnh qua Gemini browser automation
- `image-artisan/` — thư viện hướng dẫn chi tiết cho từng visual style (prompt-comparison.md, prompt-surrealist.md, prompt-typography.md, prompt-lineart.md, prompt-infographic.md). Khi cần viết prompt cho một style cụ thể, đọc file tương ứng để biết cấu trúc và kỹ thuật chuyên sâu.
- Quy tắc "no photorealistic humans" được định nghĩa ở skill này và podcast-processor. Nếu artisan skills có hướng dẫn trái ngược (ví dụ: "giữ nguyên diện mạo nhân vật"), ưu tiên quy tắc của skill này.
