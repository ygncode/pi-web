# Chào mừng đến với pi-web 🖥️

<div align="center">

[English](../en/README.md) · [Español](../es/README.md) · [Français](../fr/README.md) · [Deutsch](../de/README.md) · [中文](../zh/README.md) · [日本語](../ja/README.md) · [Bahasa Indonesia](../id/README.md) · [Bahasa Melayu](../ms/README.md) · **Tiếng Việt** · [ไทย](../th/README.md) · [Filipino](../fil/README.md) · [မြန်မာ](../my/README.md) · [ភាសាខ្មែរ](../km/README.md) · [ລາວ](../lo/README.md)

</div>

**Đang phân vân có nên thử pi-web không? Cứ thử đi — bạn sẽ mê ngay.**

pi-web là một web UI và PWA đẹp mắt dành cho [pi](https://pi.dev) — tác nhân lập trình AI mã nguồn mở. Nó cho phép bạn duyệt, đọc và tiếp tục các phiên pi của mình từ bất kỳ trình duyệt nào, trên bất kỳ thiết bị nào, với những tính năng được chăm chút ở mọi ngóc ngách.

**pi-web được xây dựng cho hai kiểu người:**

- 🧑‍💻 **Dành cho lập trình viên** — những người sống trong terminal nhưng muốn tiếp tục phiên làm việc từ điện thoại, bàn giao cho một máy chủ từ xa, hoặc theo dõi các tác vụ chạy lâu từ bất kỳ đâu.
- ✨ **Dành cho người không chuyên** — những người chỉ muốn một ứng dụng AI đẹp và hoạt động trơn tru. Mở nó ra, gõ, và tận hưởng. Không terminal, không SSH, không rối rắm. Giống như những công cụ AI thân thiện nhất, nhưng có quyền chọn model và tự do mã nguồn mở.

---

## Vì sao nên dùng pi-web?

Bạn đã quen thuộc với pi trong terminal rồi. pi-web giữ cho nhịp làm việc đó tiếp tục khi bạn rời khỏi bàn làm việc:

- **Tiếp tục từ bất kỳ đâu** — tiếp tục một phiên từ điện thoại, máy tính bảng hoặc máy tính khác. Không cần SSH, không cần Termius — chỉ cần mở trình duyệt.
- **Bảng điều khiển đa phiên** — bắt đầu công việc ở một phiên trong khi theo dõi phiên khác đang chạy. Tìm kiếm trên nhiều dự án, lọc theo nhánh, tìm nhanh thứ bạn cần.
- **Nền tảng mã nguồn mở** — pi hoàn toàn mã nguồn mở và không phụ thuộc nhà cung cấp. Bạn không bị khóa vào một model hay nhà cung cấp duy nhất. pi-web cũng mã nguồn mở.
- **Truy cập từ xa an toàn** — xác thực token tích hợp sẵn để bạn có thể mở nó trên LAN hoặc Tailscale mà không lo lắng.
- **Chia sẻ công việc của bạn** — xuất phiên dưới dạng ảnh chụp tĩnh hoặc GitHub Gists bí mật chỉ với một cú nhấp chuột.

> Tò mò về câu chuyện đằng sau? [Đọc lý do chúng tôi tạo ra nó →](why.md)

---

## pi-web như không gian làm việc AI cá nhân của bạn 🏠

pi-web là một PWA (Progressive Web App), vì vậy bạn có thể **cài đặt nó như một ứng dụng gốc** trên máy tính để bàn, laptop, điện thoại hoặc máy tính bảng — không cần app store. Trên máy tính để bàn, nó mở trong cửa sổ riêng không có giao diện trình duyệt, nên trông và dùng như một ứng dụng desktop thực thụ.

Hãy xem nó như **Claude Cowork của riêng bạn** — một không gian làm việc AI cá nhân sống ngay trên máy của bạn — chỉ khác là nó mã nguồn mở và không phụ thuộc model:

- **Bạn sở hữu toàn bộ stack.** Chọn bất kỳ model nào, đổi bất cứ lúc nào bạn muốn. Chạy model local và dữ liệu của bạn không bao giờ rời khỏi máy.
- **Người không rành kỹ thuật cũng dùng được.** Cài pi-web trên máy của họ, hướng dẫn dùng một lần, và thế là xong. Bố mẹ bạn, người yêu bạn, bạn bè không chuyên — không terminal, không SSH, chỉ là giao diện chat quen thuộc.
- **Một lần cài đặt, nhiều người dùng.** Cài trên máy tính của bạn và chia sẻ màn hình, hoặc mở nó trên mạng nội bộ để các thành viên trong gia đình dùng trên thiết bị riêng.

Muốn nhiều hơn chỉ là lập trình? Biến nó thành một [trợ lý cá nhân](personal-assistant.md) tận tâm, hiểu bạn là ai và sống trên máy của bạn — như OpenClaw hay Hermes của riêng bạn.

> 💡 **Mẹo hay:** Cài pi-web như một PWA từ Chrome/Edge (nhấp biểu tượng cài đặt trên thanh địa chỉ) hoặc Safari (Chia sẻ → Thêm vào Dock). Nó sẽ không thể phân biệt được với một ứng dụng gốc.

---

## Những gì bạn có thể làm với pi-web

| | |
|---|---|
| 📱 **PWA** | Cài pi-web như một Progressive Web App trên máy tính để bàn, điện thoại hoặc máy tính bảng để có cảm giác như ứng dụng gốc. |
| 🔄 **Tiếp tục phiên** | Tiếp tục bất kỳ cuộc trò chuyện nào đúng chỗ bạn đã dừng — văn bản, hình ảnh, đổi model, tất cả ngay từ trình duyệt. |
| 🆕 **Bắt đầu phiên mới** | Tạo phiên mới cho bất kỳ đường dẫn dự án nào, trực tiếp từ web UI. |
| 📡 **Phát trực tiếp** | Xem câu trả lời của pi chạy theo thời gian thực với độ trễ cỡ mili giây. Chế độ theo dõi giữ bạn bám theo tin mới nhất. |
| 🌲 **Xem dạng cây** | Điều hướng cây tin nhắn gốc của pi — xem toàn bộ cấu trúc cuộc trò chuyện, nhảy đến bất kỳ nhánh nào và rẽ nhánh từ bất kỳ điểm nào. |
| 🔀 **Rẽ nhánh phiên** | Rẽ nhánh một phiên từ bất kỳ tin nhắn nào, thậm chí từ một lệnh gọi tool cụ thể — khám phá các hướng khác nhau mà không mất vị trí hiện tại. |
| 🔍 **Duyệt & tìm kiếm** | Lọc phiên theo dự án, tìm theo tên, điều hướng các nhánh — toàn bộ lịch sử phiên trong tầm mắt. |
| 🌿 **Tích hợp Git** | Xem nhánh hiện tại và mở GitHub PR ngay từ trình xem phiên. |
| 📝 **Sổ ghi chú** | Ghi nhanh ghi chú, việc cần làm hoặc ý tưởng thoáng qua bên cạnh các phiên mà không cần đổi ứng dụng. |
| 💬 **Chú thích** | Tô đậm và bình luận vào bất kỳ phần nào của phiên — tuyệt vời cho việc review code, góp ý hoặc đánh dấu những khoảnh khắc quan trọng. |
| 🎨 **Giao diện & tùy chỉnh** | Chuyển giữa chế độ tối và sáng, tinh chỉnh UI theo ý bạn — biến pi-web thành *của riêng bạn*. |
| 🌐 **Đa ngôn ngữ** | 14 ngôn ngữ tích hợp (English, Español, Français, Deutsch, 中文, 日本語, Bahasa Indonesia, Bahasa Melayu, Tiếng Việt, ไทย, Filipino, မြန်မာ, ភាសាខ្មែរ, ລາວ). Thêm ngôn ngữ tùy chỉnh của riêng bạn từ Cài đặt. |
| 🐱 **Sức khỏe & pomodoro** | Vibe coding quá nhiều không tốt cho sức khỏe. Bộ đếm thời gian pomodoro tích hợp với bạn mèo đồng hành và nhắc nhở ngủ nghỉ để giữ bạn cân bằng. |
| 📤 **Chia sẻ & xuất** | Tải xuống JSONL, xuất ảnh chụp tĩnh được render với giao diện `pi.dev` gốc của pi, hoặc chia sẻ dưới dạng GitHub Gists riêng tư — tất cả đều được render phía client. |
| 🔔 **Âm thanh thông báo** | Âm báo tùy chỉnh cho các sự kiện phiên — luôn nắm bắt tình hình ngay cả khi pi-web nằm ở tab khác. |
| ⌨️ **Phím tắt** | Điều hướng kiểu Vim, thao tác nhanh — [tham khảo đầy đủ →](keyboard-shortcuts.md) |
| 🤖 **Trợ lý cá nhân** | Biến pi-web thành trợ lý AI của riêng bạn sống trên máy tính — như OpenClaw hay Hermes. [Thiết lập ngay →](personal-assistant.md) |
| 🗓️ **Nói chuyện với lịch trình** | Từ một phiên pi, hãy nói “thêm lịch vào 2 giờ sáng giờ Singapore để …” — `/skill:pi-web-schedule`. |
| 📝 **Nói chuyện với ghi chú & cài đặt** | “Ghi cái này vào ghi chú” (`/skill:pi-web-notes`) hoặc “chuyển sang chế độ tối” (`/skill:pi-web-settings`). |

---

## Điều hướng nhanh

| Nếu bạn đang tìm… | Đọc |
|---|---|
| Cách cài đặt, cấu hình và sử dụng pi-web | [install.md](install.md) |
| Dùng pi-web làm trợ lý cá nhân | [personal-assistant.md](personal-assistant.md) |
| Tham khảo phím tắt | [keyboard-shortcuts.md](keyboard-shortcuts.md) |
| Vì sao pi-web tồn tại | [why.md](why.md) |
| Điều gì sắp ra mắt | [roadmap.md](roadmap.md) |
| Gặp lỗi khi cài đặt? Để LLM của bạn sửa — dán link llm-debug.md cho nó | [llm-debug.md](llm-debug.md) |

---

## Ảnh chụp màn hình

| Máy tính | Điện thoại |
|---|---|
| ![Máy tính](../assets/pi-web-desktop-screenshot.png) | ![Điện thoại](../assets/pi-web-mobile-screenshot.png) |

---

## 💛 Tài trợ

pi-web được xây dựng bằng tình yêu và rất nhiều đêm thức khuya. Tôi tự bỏ tiền túi trả cho các gói lập trình (Claude Code, OpenCode, v.v.) để duy trì dự án này. Nếu pi-web hữu ích với bạn, sự ủng hộ của bạn có ý nghĩa vô cùng to lớn.

**Các cách để giúp đỡ:**

- 💰 **[Tài trợ trên GitHub](https://github.com/sponsors/setkyar)** — giúp trang trải các công cụ làm nên dự án này
- ☕ **[Mời tôi một ly cà phê](https://buymeacoffee.com/setkyar)** — mỗi chút đóng góp đều đáng quý
- ⭐ **Star repo** — không tốn gì cả và giúp nhiều người biết đến pi-web hơn
- 📢 **Chia sẻ với bạn bè & gia đình** — nếu bạn biết ai đó sẽ thích pi-web, hãy gửi nó cho họ

Không thể tài trợ? Không sao cả — một star và một lượt chia sẻ đã là rất nhiều. Cảm ơn bạn đã ở đây. 🙏

---

Chúc bạn code vui! 🚀
