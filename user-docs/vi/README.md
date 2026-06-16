# Chào mừng đến với pi-web 🖥️

<div align="center">

[English](../en/README.md) · [Español](../es/README.md) · [Français](../fr/README.md) · [Deutsch](../de/README.md) · [中文](../zh/README.md) · [日本語](../ja/README.md) · [Bahasa Indonesia](../id/README.md) · [Bahasa Melayu](../ms/README.md) · **Tiếng Việt** · [ไทย](../th/README.md) · [Filipino](../fil/README.md) · [မြန်မာ](../my/README.md) · [ភាសាខ្មែរ](../km/README.md) · [ລາວ](../lo/README.md)

</div>

**Đang cân nhắc dùng thử pi-web? Cứ thử đi — bạn sẽ thích mê.**

pi-web là giao diện web và PWA đẹp mắt dành cho [pi](https://pi.dev) — trợ lý lập trình AI mã nguồn mở. Nó cho phép bạn duyệt, đọc và tiếp tục các phiên pi từ bất kỳ trình duyệt nào, trên bất kỳ thiết bị nào, với những tính năng được chăm chút ở mọi ngóc ngách.

**pi-web được xây dựng cho hai kiểu người dùng:**

- 🧑‍💻 **Dành cho lập trình viên** — những người sống trong terminal nhưng muốn tiếp tục phiên làm việc từ điện thoại, chuyển sang máy chủ từ xa, hoặc theo dõi các tác vụ chạy dài từ bất kỳ đâu.
- ✨ **Dành cho người không chuyên** — những người chỉ muốn một ứng dụng AI đẹp và hoạt động trơn tru. Mở lên, gõ, tận hưởng. Không terminal, không SSH, không rắc rối. Giống như những công cụ AI thân thiện nhất, nhưng có tự do chọn model và mã nguồn mở.

---

## Tại sao chọn pi-web?

Bạn đang say mê làm việc với pi trong terminal. pi-web giúp bạn duy trì đà làm việc đó khi bạn rời khỏi bàn:

- **Tiếp tục từ bất kỳ đâu** — tiếp tục phiên làm việc từ điện thoại, máy tính bảng, hoặc máy tính khác. Không cần SSH, không cần Termius — chỉ cần mở trình duyệt.
- **Bảng điều khiển đa phiên** — khởi động công việc trong một phiên trong khi theo dõi phiên khác đang chạy. Tìm kiếm xuyên suốt các dự án, lọc theo nhánh, tìm thứ bạn cần một cách nhanh chóng.
- **Nền tảng mã nguồn mở** — pi hoàn toàn là mã nguồn mở và không phụ thuộc nhà cung cấp. Bạn không bị khóa vào một model hay nhà cung cấp duy nhất. pi-web cũng là mã nguồn mở.
- **Truy cập từ xa an toàn** — xác thực token tích hợp sẵn để bạn có thể mở nó trên mạng LAN hoặc Tailscale mà không lo lắng.
- **Chia sẻ công việc** — xuất phiên làm việc dưới dạng ảnh chụp tĩnh hoặc GitHub Gist bí mật chỉ với một cú nhấp chuột.

> Tò mò về câu chuyện đằng sau? [Đọc lý do chúng tôi xây dựng nó →](why.md)

---

## pi-web như không gian làm việc AI cá nhân của bạn 🏠

pi-web là một PWA (Progressive Web App — Ứng dụng Web Tiến bộ), vì vậy bạn có thể **cài đặt nó như một ứng dụng gốc** trên máy tính để bàn, laptop, điện thoại hoặc máy tính bảng — không cần cửa hàng ứng dụng. Trên máy tính để bàn, nó mở trong cửa sổ riêng không có thanh trình duyệt, trông và cảm nhận như một ứng dụng desktop thực thụ.

Hãy nghĩ về nó như **Claude Cowork của riêng bạn** — một không gian làm việc AI cá nhân sống trên máy của bạn — ngoại trừ việc nó là mã nguồn mở và không phụ thuộc model:

- **Bạn làm chủ toàn bộ hệ thống.** Chọn bất kỳ model nào, chuyển đổi bất cứ lúc nào. Chạy model cục bộ và dữ liệu của bạn không bao giờ rời khỏi máy.
- **Người không chuyên cũng dùng được.** Cài đặt pi-web trên máy của họ, hướng dẫn họ dùng một lần, thế là xong. Bố mẹ bạn, người yêu bạn, bạn bè không chuyên về công nghệ — không terminal, không SSH, chỉ là giao diện trò chuyện quen thuộc.
- **Một lần cài đặt, nhiều người dùng.** Cài đặt trên máy desktop của bạn và chia sẻ màn hình, hoặc mở nó trên mạng gia đình và để các thành viên trong nhà mở trên thiết bị riêng của họ.

Muốn nhiều hơn là lập trình? Biến nó thành một [trợ lý cá nhân](personal-assistant.md) chuyên dụng hiểu bạn là ai và sống trên máy của bạn — giống như OpenClaw hoặc Hermes của riêng bạn.

> 💡 **Mẹo chuyên nghiệp:** Cài đặt pi-web dưới dạng PWA từ Chrome/Edge (nhấp biểu tượng cài đặt trên thanh địa chỉ) hoặc Safari (Chia sẻ → Thêm vào Dock). Nó trở nên không thể phân biệt được với ứng dụng gốc.

---

## Những gì bạn có thể làm với pi-web

| | |
|---|---|
| 📱 **PWA** | Cài đặt pi-web dưới dạng Progressive Web App trên desktop, điện thoại hoặc máy tính bảng để có trải nghiệm như ứng dụng gốc. |
| 🔄 **Tiếp tục phiên** | Tiếp tục bất kỳ cuộc trò chuyện nào ngay tại chỗ bạn dừng lại — văn bản, hình ảnh, chuyển đổi model, tất cả từ trình duyệt. |
| 🆕 **Bắt đầu phiên mới** | Tạo phiên mới với bất kỳ đường dẫn dự án nào, trực tiếp từ giao diện web. |
| 📡 **Phát trực tiếp** | Xem phản hồi của pi chạy theo thời gian thực với độ trễ ~ms. Chế độ theo dõi giúp bạn luôn ở dòng mới nhất. |
| 🌲 **Xem dạng cây** | Điều hướng cây tin nhắn gốc của pi — xem toàn bộ cấu trúc cuộc trò chuyện, nhảy đến bất kỳ nhánh nào và rẽ nhánh từ bất kỳ điểm nào. |
| 🔀 **Rẽ nhánh phiên** | Rẽ nhánh một phiên từ bất kỳ tin nhắn nào hoặc thậm chí từ một lệnh gọi công cụ cụ thể — khám phá các hướng khác nhau mà không mất vị trí hiện tại. |
| 🔍 **Duyệt & tìm kiếm** | Lọc phiên theo dự án, tìm kiếm theo tên, điều hướng nhánh — toàn bộ lịch sử phiên trong tầm mắt. |
| 🌿 **Tích hợp Git** | Xem nhánh hiện tại và mở GitHub PR trực tiếp từ trình xem phiên. |
| 📝 **Sổ tay** | Ghi nhanh ghi chú, việc cần làm, hoặc suy nghĩ bên cạnh các phiên làm việc mà không cần chuyển ứng dụng. |
| 💬 **Chú thích** | Đánh dấu và bình luận trên bất kỳ phần nào của phiên — tuyệt vời cho việc xem xét mã, phản hồi, hoặc đánh dấu những khoảnh khắc quan trọng. |
| 🎨 **Chủ đề & tùy chỉnh** | Chuyển đổi giữa chế độ tối và sáng, tinh chỉnh giao diện theo ý thích — khiến pi-web thực sự là *của bạn*. |
| 🌐 **Đa ngôn ngữ** | 14 ngôn ngữ tích hợp sẵn (English, Español, Français, Deutsch, 中文, 日本語, Bahasa Indonesia, Bahasa Melayu, Tiếng Việt, ไทย, Filipino, မြန်မာ, ភាសាខ្មែរ, ລາວ). Thêm ngôn ngữ tùy chỉnh của riêng bạn từ Cài đặt. |
| 🐱 **Sức khỏe & pomodoro** | Quá nhiều vibe coding không tốt cho sức khỏe. Bộ hẹn giờ pomodoro tích hợp với bạn mèo đồng hành và nhắc nhở đi ngủ để giữ bạn cân bằng. |
| 📤 **Chia sẻ & xuất** | Tải xuống JSONL, xuất ảnh chụp tĩnh được hiển thị với giao diện `pi.dev` gốc của pi, hoặc chia sẻ dưới dạng GitHub Gist bí mật — tất cả được xử lý phía máy khách. |
| 🔔 **Âm thanh thông báo** | Âm thanh thông báo tùy chỉnh cho các sự kiện phiên — luôn cập nhật ngay cả khi pi-web đang ở tab khác. |
| ⌨️ **Phím tắt** | Điều hướng kiểu Vim, thao tác nhanh — [tham khảo đầy đủ →](keyboard-shortcuts.md) |
| 🤖 **Trợ lý cá nhân** | Biến pi-web thành trợ lý AI của riêng bạn sống trên máy tính — giống như OpenClaw hoặc Hermes. [Thiết lập ngay →](personal-assistant.md) |

---

## Điều hướng nhanh

| Nếu bạn đang tìm… | Đọc |
|---|---|
| Cách cài đặt, cấu hình và sử dụng pi-web | [install.md](install.md) |
| Dùng pi-web như trợ lý cá nhân | [personal-assistant.md](personal-assistant.md) |
| Tham khảo phím tắt | [keyboard-shortcuts.md](keyboard-shortcuts.md) |
| Tại sao pi-web tồn tại | [why.md](why.md) |
| Những gì sắp ra mắt | [roadmap.md](roadmap.md) |
| Gặp vấn đề khi cài đặt? Hãy để LLM của bạn sửa nó — dán liên kết llm-debug.md cho họ | [llm-debug.md](llm-debug.md) |

---

## Ảnh chụp màn hình

| Desktop — chế độ tối | Desktop — chế độ sáng | PWA trên điện thoại |
|---|---|---|
| ![Desktop chế độ tối](../assets/desktop-dark-mode.png) | ![Desktop chế độ sáng](../assets/desktop-white-mode.png) | ![PWA trên điện thoại](../assets/mobile-pwa.png) |

---

## 💛 Tài trợ

pi-web được xây dựng bằng tình yêu và rất nhiều đêm thức khuya. Tôi tự trả tiền cho các gói lập trình (Claude Code, OpenCode, v.v.) để duy trì dự án này. Nếu pi-web đã hữu ích với bạn, sự ủng hộ của bạn sẽ có ý nghĩa rất lớn.

**Các cách giúp đỡ:**

- 💰 **[Tài trợ trên GitHub](https://github.com/sponsors/setkyar)** — giúp trang trải các công cụ làm nên dự án này
- ☕ **[Mua cho tôi ly cà phê](https://buymeacoffee.com/setkyar)** — mỗi chút đều đáng quý
- ⭐ **Thả sao cho repo** — không tốn gì và giúp nhiều người khám phá pi-web hơn
- 📢 **Chia sẻ với bạn bè & gia đình** — nếu bạn biết ai đó sẽ thích pi-web, hãy gửi cho họ

Không thể tài trợ? Không sao cả — một ngôi sao và một lượt chia sẻ cũng đi được một chặng đường dài. Cảm ơn bạn đã ở đây. 🙏

---

Chúc bạn lập trình vui vẻ! 🚀
