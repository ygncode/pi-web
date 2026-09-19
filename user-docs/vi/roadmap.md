# Lộ trình

pi-web được xây dựng cho hai nhóm người dùng:

- **Cho nhà phát triển** — những người sống trong terminal nhưng muốn tiếp tục phiên làm việc từ điện thoại, bàn giao cho một máy chủ từ xa, hoặc theo dõi các tác vụ chạy lâu từ bất kỳ đâu.
- **Cho người dùng phổ thông** — những người chỉ muốn một ứng dụng AI đẹp và hoạt động tốt. Mở nó ra, gõ, tận hưởng. Không terminal, không SSH, không phức tạp. Giống như những công cụ AI thân thiện nhất, nhưng có thêm lựa chọn model và sự tự do của mã nguồn mở.

Đây là những gì sắp ra mắt.

---

## Hiện tại (đã phát hành)

Mọi thứ liệt kê trong [bảng tính năng](README.md#what-you-can-do-with-pi-web) hiện đã hoạt động.

Các tính năng từng nằm trong lộ trình này và nay đã được phát hành:

| Tính năng | Chức năng |
|---|---|
| **Điều hướng / hàng đợi** ([#46](https://github.com/ygncode/pi-web/issues/46)) | Gửi chỉ dẫn bổ sung trong khi pi vẫn đang chạy, hoặc xếp hàng các tin nhắn cho lượt tiếp theo. |
| **Bộ lập lịch** ([#44](https://github.com/ygncode/pi-web/issues/44)) | Lên lịch để prompt chạy tự động — họp standup hằng ngày, tóm tắt buổi sáng, các tác vụ định kỳ — từ trang `/schedules`. |
| **Tùy chỉnh hiển thị mặc định** ([#48](https://github.com/ygncode/pi-web/issues/48)) | Đặt mức hiển thị ưa thích cho phần suy nghĩ (thinking), công cụ và đầu ra của công cụ trên tất cả các phiên. |
| **Git diff** (một phần của [#47](https://github.com/ygncode/pi-web/issues/47)) | Xem các thay đổi chưa commit trong working tree ở modal diff của phiên, kèm theo nhận xét đánh giá. |

---

## Sắp tới

| # | Tính năng | Chức năng |
|---|---|---|
| [#50](https://github.com/ygncode/pi-web/issues/50) | **Bot Telegram & Discord** | Trò chuyện với pi qua Telegram hoặc Discord — hoàn hảo cho quy trình trợ lý cá nhân khi đang di chuyển. |
| [#49](https://github.com/ygncode/pi-web/issues/49) | **Thông tin chi tiết về mức sử dụng** | Theo dõi token xuyên phiên, ước tính chi phí và phân tích — vượt xa bảng phân tích theo từng phiên trong menu phiên. |
| [#41](https://github.com/ygncode/pi-web/issues/41) | **Lệnh `/compact`** | Rút gọn các cuộc hội thoại dài ngay từ giao diện web, không cần terminal. |

---

## Trong kế hoạch

| # | Tính năng | Chức năng |
|---|---|---|
| [#47](https://github.com/ygncode/pi-web/issues/47) | **Trình quản lý tệp** | Duyệt cây tệp của dự án trực tiếp trong pi-web. Tùy chọn bật, nên nó không gây phiền. |
| [#43](https://github.com/ygncode/pi-web/issues/43) | **Phím tắt tùy chỉnh** | Gán lại mọi phím tắt theo thói quen của bạn. |

---

## Tầm nhìn

Mục tiêu dài hạn: pi-web nên là **giao diện cho pi** — dành cho tất cả mọi người.

- **Người dùng phổ thông** mở nó như bất kỳ ứng dụng nào khác. Chọn model. Gõ. Xong. Không bao giờ phải dùng dòng lệnh.
- **Nhà phát triển** có được tích hợp sâu — bàn giao từ xa, bảng điều khiển đa phiên, duyệt tệp nhận biết Git, bot nhắn tin.
- **Tất cả mọi người** có được tự do chọn model, sự minh bạch của mã nguồn mở và một giao diện chu đáo ở mọi ngóc ngách.

---

> 💡 Có ý tưởng? [Mở một issue](https://github.com/ygncode/pi-web/issues/new) hoặc tham gia thảo luận.
