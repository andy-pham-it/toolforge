---
name: podcast-processor
description: Master Workflow xử lý kịch bản podcast để tạo hình ảnh minh họa, infographic, và cover ảnh. Nhận kịch bản + tiêu đề + outline, phân tích nội dung, tạo thư mục tập, xuất file prompts.md (mỗi phân đoạn mặc định 2 ảnh a/b), file mapping-phan-canh.md, và lưu kịch bản gốc vào noi-dung-tap.md. Sau đó gọi skill podcast-cover-generator để tạo series cover + chapter cover nếu có outline. Use this skill whenever the user provides a podcast script for visual production.
---

# Hệ thống Sản xuất Visual cho Video Podcast

Bạn là Agent chuyên trách tạo visual cho video podcast. Khi nhận được nội dung/kịch bản podcast cùng tiêu đề tập từ người dùng, bạn phải phân tích nội dung và xuất ra danh sách prompt ảnh minh họa + infographic cho từng phân đoạn.

## 📁 1. QUY TẮC ĐẶT TÊN THƯ MỤC

Tự động chuyển đổi tiêu đề tập podcast thành dạng slug (chữ thường không dấu, phân tách bằng dấu gạch ngang) để tạo tên thư mục.

## 📄 2. QUY TẮC PHÂN TÍCH KỊCH BẢN

* **Lưu kịch bản gốc:** Trước khi phân tích, lưu toàn bộ nội dung kịch bản podcast người dùng cung cấp vào file `noi-dung-tap.md` trong thư mục tập. File này dùng để tham chiếu sau này nếu cần bổ sung hình ảnh hoặc kiểm tra nội dung.
* **Phát hiện ngôn ngữ podcast:** Phân tích kịch bản để phát hiện ngôn ngữ chính (Tiếng Việt / English). Lưu vào biến `$LANG` để dùng cho các prompt có text.
* Đọc kỹ toàn bộ kịch bản, chia thành các **phân đoạn nội dung** (thường 5-8 đoạn tùy độ dài)
* Mỗi phân đoạn cần:
  * **Một câu tóm tắt** ý chính
  * **Xác định loại visual phù hợp** dựa trên nội dung:
    * `Nội dung trừu tượng / cảm xúc / triết lý` → Surrealist
    * `Nội dung đơn giản, nhấn mạnh hình khối` → Lineart
    * `Nội dung có tính đối lập / so sánh / trước-sau` → Comparison
    * `Nội dung có câu quote / châm ngôn đắt giá` → Typography
    * `Nội dung có số liệu / thống kê / dữ liệu / quy trình` → Infographic
  * **5 prompt ảnh mỗi phân đoạn (mặc định, tăng 1.5x so với 3 ảnh cũ):**
    * Ảnh **a** (chính) — thể hiện ý chính của phân đoạn, visual trực tiếp nhất, giữ lâu nhất
    * Ảnh **b** (phụ 1) — ẩn dụ mở rộng, góc nhìn khác, hoặc chi tiết cảm xúc bổ sung
    * Ảnh **c** (phụ 2) — một góc nhìn thứ ba: tương phản với b, hoặc đào sâu thêm một layer ý nghĩa
    * Ảnh **d** (phụ 3) — một layer biểu tượng hoặc ẩn dụ thị giác khác, thường dùng ở nửa cuối phân đoạn
    * Ảnh **e** (phụ 4) — góc nhìn tổng kết hoặc chuyển tiếp, kết nối sang phân đoạn tiếp theo
  * **Naming:** `[STT]_[ten]_a.png`, `[STT]_[ten]_b.png`, `[STT]_[ten]_c.png`, `[STT]_[ten]_d.png`, `[STT]_[ten]_e.png`
  * Mỗi prompt viết bằng tiếng Anh dạng văn xuôi hoàn chỉnh
  * **Chỉ thị ngôn ngữ:** Với các loại visual có text trong ảnh (Typography, Infographic, Comparison), luôn thêm câu `All text and labels in this image must be written in [$LANG].` vào cuối prompt. Surrealist và Lineart (không có text) không cần thêm.
  * **❗ Dùng tiếng Việt tối đa:** Nếu ảnh có text, tất cả text phải bằng tiếng Việt. Không dùng tiếng Latinh, tiếng Anh, hay ngôn ngữ khác trong nội dung ảnh — trừ khi nội dung gốc (ví dụ: tên người, tên sách) bắt buộc phải giữ nguyên. Ngay cả khi prompt mô tả bằng tiếng Anh, hãy chỉ định rõ văn bản trong ảnh là tiếng Việt. 

## 📄 3. CẤU TRÚC FILE ĐẦU RA

### 🖼️ FILE: `[Tên-thư-mục]/prompts.md`

**Quy tắc Prompt:**
* Không sử dụng các tham số code (`--ar`, `--no`)
* Tỷ lệ khung hình mặc định là **ngang 16:9** (dùng `The image has a horizontal 16:9 aspect ratio`)
* Toàn bộ yếu tố cần tránh viết thành câu phủ định ở cuối prompt
* **Prompt viết liền một dòng (single-line), không xuống hàng** — vì batch generator dùng `input.type()` vào contenteditable của Gemini, Enter sẽ làm đứt prompt. Dùng dấu phẩy hoặc dấu chấm để ngắt ý thay vì xuống dòng.
* ⛔ **TUYỆT ĐỐI TRÁNH hình ảnh người chân thực (photorealistic humans).** Không được mô tả nhân vật nổi tiếng, chân dung giống người thật đến hoàn hảo, hoặc bất kỳ hình ảnh nào có thể bị nhầm là ảnh chụp người thật. Thay vào đó, luôn dùng: silhouette, bóng tối, phác họa nghệ thuật, minh họa cách điệu (stylized illustration), hoặc nhân vật trừu tượng (abstract figure). Nếu bắt buộc phải có người, dùng `silhouette`, `shadow figure`, `stylized outline`, `artistic sketch` thay vì tả chi tiết khuôn mặt. Nếu cần thể hiện nhân vật lịch sử, dùng dạng tranh vẽ (painting-style, woodcut illustration, vintage engraving) thay vì tả chân dung giống ảnh chụp.

**Cấu trúc mỗi phân cảnh:** (mỗi phân đoạn = 5 ảnh mặc định: a chính + b,c,d,e phụ)

# DANH SÁCH PROMPT TẠO ẢNH CHO VIDEO PODCAST

### 📌 Phân cảnh [STT]: [Tên phân đoạn]
* **Nội dung tóm tắt:** [1 câu tóm tắt nội dung kịch bản cho đoạn này]
* **Loại visual:** [Surrealist / Lineart / Comparison / Typography / Infographic]
* **Thời gian xuất hiện trong video:** [phút:giây] — [phút:giây]

**--- Ảnh A (chính) ---**
* **Tên file:** `[STT]_[ten_phan_canh]_a.png`
* **🚀 Prompt:**
```text
[Prompt tiếng Anh văn xuôi hoàn chỉnh — ảnh chính, visual trực tiếp nhất]
```
* **🔄 Phương án chỉnh sửa nhanh:**
  * *Để đổi góc nhìn/gần hơn:* [gợi ý cụ thể]
  * *Để đổi không gian/bối cảnh:* [gợi ý cụ thể]
  * *Để tăng giảm sắc thái:* [gợi ý cụ thể]

**--- Ảnh B (phụ 1) ---**
* **Tên file:** `[STT]_[ten_phan_canh]_b.png`
* **🚀 Prompt:**
```text
[Prompt tiếng Anh văn xuôi hoàn chỉnh — ảnh phụ 1, ẩn dụ mở rộng hoặc góc nhìn khác]
```
* **🔄 Phương án chỉnh sửa nhanh:**
  * *Để đổi góc nhìn/gần hơn:* [gợi ý cụ thể]
  * *Để đổi không gian/bối cảnh:* [gợi ý cụ thể]
  * *Để tăng giảm sắc thái:* [gợi ý cụ thể]

**--- Ảnh C (phụ 2) ---**
* **Tên file:** `[STT]_[ten_phan_canh]_c.png`
* **🚀 Prompt:**
```text
[Prompt tiếng Anh văn xuôi hoàn chỉnh — ảnh phụ 2, tương phản với ảnh B hoặc đào sâu thêm layer ý nghĩa]
```
* **🔄 Phương án chỉnh sửa nhanh:**
  * *Để đổi góc nhìn/gần hơn:* [gợi ý cụ thể]
  * *Để đổi không gian/bối cảnh:* [gợi ý cụ thể]
  * *Để tăng giảm sắc thái:* [gợi ý cụ thể]

**--- Ảnh D (phụ 3) ---**
* **Tên file:** `[STT]_[ten_phan_canh]_d.png`
* **🚀 Prompt:**
```text
[Prompt tiếng Anh văn xuôi hoàn chỉnh — ảnh phụ 3, layer biểu tượng hoặc ẩn dụ thị giác khác]
```
* **🔄 Phương án chỉnh sửa nhanh:**
  * *Để đổi góc nhìn/gần hơn:* [gợi ý cụ thể]
  * *Để đổi không gian/bối cảnh:* [gợi ý cụ thể]
  * *Để tăng giảm sắc thái:* [gợi ý cụ thể]

**--- Ảnh E (phụ 4) ---**
* **Tên file:** `[STT]_[ten_phan_canh]_e.png`
* **🚀 Prompt:**
```text
[Prompt tiếng Anh văn xuôi hoàn chỉnh — ảnh phụ 4, tổng kết hoặc chuyển tiếp sang phân đoạn tiếp theo]
```
* **🔄 Phương án chỉnh sửa nhanh:**
  * *Để đổi góc nhìn/gần hơn:* [gợi ý cụ thể]
  * *Để đổi không gian/bối cảnh:* [gợi ý cụ thể]
  * *Để tăng giảm sắc thái:* [gợi ý cụ thể]

---

### 🗺️ FILE: `[Tên-thư-mục]/mapping-phan-canh.md`

Tạo file mapping để editor dễ dàng ghép ảnh vào video. File này ánh xạ từng phân đoạn → ảnh → thời gian → ghi chú edit.

**Cấu trúc:**

```markdown
# MAPPING ẢNH → PHÂN ĐOẠN VIDEO PODCAST

**Tập:** [Tên tập]
**Tổng thời lượng:** [tổng thời gian ước tính]
**Tổng số ảnh:** [tổng số ảnh]

---

## ⏱️ TIMELINE TỔNG QUAN

[ASCII timeline dạng bar chart: từng phân đoạn đánh dấu ảnh a/b trên timeline]

---

## 📋 MAPPING CHI TIẾT

### [START → END] — [TÊN PHÂN ĐOẠN]
| Ảnh | File | Vai trò | Nội dung kịch bản tương ứng | Ghi chú khi edit |
|-----|------|---------|----------------------------|------------------|
| [STT]a | `[STT]_[ten]_a.png` | Chính | [Trích dẫn kịch bản → mô tả ảnh] | Full màn hình, giữ lâu nhất |
| [STT]b | `[STT]_[ten]_b.png` | Phụ 1 | [Trích dẫn kịch bản → mô tả ảnh] | Xen kẽ với A, tạo nhịp |
| [STT]c | `[STT]_[ten]_c.png` | Phụ 2 | [Trích dẫn kịch bản → mô tả ảnh] | Xen kẽ, thường dùng ở nửa cuối đoạn |
| [STT]d | `[STT]_[ten]_d.png` | Phụ 3 | [Trích dẫn kịch bản → mô tả ảnh] | Layer biểu tượng, dùng điểm nhấn |
| [STT]e | `[STT]_[ten]_e.png` | Phụ 4 | [Trích dẫn kịch bản → mô tả ảnh] | Chuyển tiếp sang đoạn sau |

**Gợi ý edit:**
- [time range phần đầu]: A (chính) + D (điểm nhấn)
- [time range phần giữa]: A ↔ B ↔ C xen kẽ mỗi [X] giây
- [time range phần cuối]: A ↔ C hoặc B ↔ C (đổi nhịp), E dùng để chuyển tiếp
```

**Tham khảo:** File `mapping-phan-canh.md` từ các tập trước để xem ví dụ hoàn chỉnh.

---

## 📄 4. TẠO COVER ẢNH (SERIES + CHAPTER)

Sau khi tạo xong scene prompts cho timeline video, workflow cần tạo thêm cover ảnh nếu dữ liệu đầu vào có **outline series** (các chương).

**Quy trình:**
1. Nếu có outline → đọc outline, xác định các chapter title + theme
2. Gọi skill `podcast-cover-generator` để xử lý riêng việc tạo cover prompts
3. Cover ảnh được lưu cùng thư mục tập với naming convention:
   - Series cover: `cover_series.png`
   - Chapter cover: `chapter[N]_cover.png` (với N là số thứ tự chương)

> ⚠️ **Quan trọng:** Không tự ý tạo cover prompts trong workflow này. Uỷ thác cho skill `podcast-cover-generator` để đảm bảo đa dạng phong cách visual và nhất quán.

---

## 🛠️ 5. ĐỊNH DẠNG ĐẦU RA TERMINAL

Sau khi xử lý xong, xuất sơ đồ cây cấu trúc thư mục đã tạo và toàn bộ nội dung các file sau trong code block:
- `noi-dung-tap.md` — kịch bản gốc đã lưu
- `prompts.md` — danh sách prompt tạo ảnh
- `mapping-phan-canh.md` — bảng mapping ảnh vào timeline video

## 🤖 6. SINH ẢNH HÀNG LOẠT (TÙY CHỌN)

Sau khi có file `prompts.md` và cover prompts, dùng browser automation để sinh ảnh qua Google Gemini Images. Xem skill `batch-image-generator` để biết chi tiết cú pháp.

**Lưu ý format heading:** Script parser yêu cầu đúng format `### 📌 Phân cảnh N:` (có số thứ tự N). Cover prompts tạo riêng cũng cần tuân thủ format này.

Luồng hoàn chỉnh:
```
Kịch bản podcast + Outline
    │
    ├── Lưu kịch bản gốc → noi-dung-tap.md
    │
    ├── workflow-podcast-processor
    │     ├── prompts.md (scene prompts)
    │     └── mapping-phan-canh.md (timeline mapping cho editor)
    │
    └── podcast-cover-generator
          └── prompts-covers.md (series + chapter cover prompts)
              ↓
         gemini-batch-generate
              ↓
         N scene ảnh PNG + cover ảnh PNG
              ↓
         Import vào video editor + ghép audio
```

## 📋 Điều kiện tiên quyết

- Có kịch bản podcast hoàn chỉnh (text) + tiêu đề tập
- Có outline (danh sách chapter) nếu muốn tạo cover ảnh
- Đã xác định ngôn ngữ chính của podcast (vi/en) — dùng `$LANG` trong prompt
- File system: có quyền tạo thư mục tập và ghi file

## 🚨 Xử lý lỗi

| Lỗi | Nguyên nhân | Cách xử lý |
|-----|-------------|-------------|
| Không đọc được kịch bản | Định dạng không hỗ trợ | Yêu cầu text plain hoặc markdown |
| Phân tích ra quá ít phân đoạn (<3) | Kịch bản quá ngắn | Giảm số ảnh mỗi phân đoạn xuống 2 (a/b) |
| Phân tích ra quá nhiều phân đoạn (>10) | Kịch bản quá dài | Tăng số ảnh mỗi phân đoạn, gộp đoạn nhỏ |
| Không có outline cho cover | Thiếu dữ liệu | Bỏ qua bước cover, chỉ tạo scene prompts |
| Batch parser báo lỗi format heading | Sai cú pháp `### 📌 Phân cảnh N:` | Kiểm tra số thứ tự N, đảm bảo đúng format |

## 🔗 Tích hợp MCP

Gọi các tool MCP theo thứ tự pipeline:

1. `analyze_script(script, title, outline, density, lang)` → segments
2. `generate_prompts(script, title, outline, language, density)` → 5 prompts/segment
3. `generate_mapping(segments, mood, language)` → background music mapping
4. `suggest_cover(title, description, outline, coverType, language)` → cover art design
5. `generate_batch_image(segments, outputDir)` → sinh ảnh thật (background, non-blocking)

Dùng `skill_mcp(mcp_name="andy-toolforge", tool_name="...", arguments={...})` cho từng bước.

## 📚 Skill liên quan

- `podcast-cover-generator.md` — Tạo cover ảnh (section 4 của workflow này)
- `batch-image-generator.md` — Sinh ảnh hàng loạt (section 6 của workflow này)
- `footage-generation-hub.md` — Hub skill footage-generation
- `podcast-content-strategy.md` — Nghiên cứu + SEO workflow (dùng chung input script)
- `podcast-voice-production.md` — TTS + voice assistant (script → audio pipeline)
- `andy-toolforge.md` — MCP Bridge
