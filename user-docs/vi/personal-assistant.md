# pi-web làm Trợ lý Cá nhân của Bạn

pi-web không chỉ dành cho việc lập trình — bạn có thể biến nó thành một **trợ lý AI cá nhân** sống ngay trên máy tính của bạn, giống như có OpenClaw hoặc Hermes của riêng mình.

## Cách hoạt động

Bạn tạo một thư mục riêng trên máy — đó là nơi trợ lý của bạn "sống". Bên trong, bạn đặt một tệp `APPEND_SYSTEM.md` định nghĩa trợ lý của bạn là ai, nó biết những gì và cư xử như thế nào. pi-web cung cấp cho bạn một giao diện trò chuyện đẹp mắt để nói chuyện với nó từ bất kỳ thiết bị nào.

## Từng bước thực hiện

### 1. Tạo thư mục trợ lý của bạn

Chọn một thư mục trên máy tính của bạn. Ví dụ như:

```
~/my-assistant/
```

### 2. Định nghĩa trợ lý của bạn

Tạo một tệp `APPEND_SYSTEM.md` bên trong thư mục đó. Đây là nơi bạn cho pi biết trợ lý của bạn là ai:

```markdown
# My Personal Assistant

You are Jarvis, my personal AI assistant. You help me with:

- Daily planning and reminders
- Research and summarization
- Drafting emails and messages
- Brainstorming ideas
- Keeping track of things I mention

## About me

- I'm a software engineer who works remotely
- I have a cat named Pixel
- I prefer short, direct answers
- My timezone is PST

## Rules

- Be concise — I value brevity
- If you don't know something, say so
- Proactively remind me of things I asked you to track
```

pi tự động thêm nội dung này vào system prompt của mọi cuộc trò chuyện, vì vậy trợ lý của bạn luôn biết bạn là ai và cách giúp đỡ bạn.

### 3. Bắt đầu một phiên trong thư mục đó

Trong pi-web, tạo một phiên mới trỏ tới `~/my-assistant/` (hoặc bất kỳ tên nào bạn đã đặt). Vậy là xong — bạn đang trò chuyện với trợ lý cá nhân của mình.

### 4. Sử dụng từ bất kỳ đâu

Cài đặt pi-web dưới dạng PWA trên điện thoại, máy tính bảng hoặc máy tính xách tay. Trợ lý của bạn luôn ở đó — hãy hỏi nó bất cứ điều gì, bất cứ lúc nào.

## Ý tưởng cho trợ lý của bạn

| Vai trò | Nội dung cần đưa vào APPEND_SYSTEM.md |
|---|---|
| 🧠 **Huấn luyện viên cuộc sống** | Mục tiêu của bạn, thói quen bạn đang rèn luyện, gợi ý viết nhật ký |
| 🏠 **Quản lý gia đình** | Định dạng danh sách mua sắm, sở thích của các thành viên trong gia đình, lên kế hoạch bữa ăn |
| 💼 **Bạn đồng hành công việc** | Vai trò của bạn, các dự án hiện tại, định dạng ghi chú cuộc họp, bối cảnh công ty |
| 📚 **Bạn học** | Nội dung bạn đang học, phong cách giải thích ưa thích, chế độ kiểm tra tôi |
| ✍️ **Trợ lý viết lách** | Phong cách viết của bạn, sở thích về giọng điệu, các định dạng thường dùng |

## Thêm ngữ cảnh

Bạn có thể đặt bất cứ thứ gì vào thư mục trợ lý để giúp pi hữu ích hơn:

- `notes/` — các tệp tham khảo mà trợ lý của bạn có thể đọc
- `context.md` — thông tin nền tảng về cuộc sống hoặc công việc của bạn
- `projects.md` — các dự án hiện tại và trạng thái của chúng

pi có thể đọc các tệp trong thư mục, vì vậy bạn càng cung cấp nhiều ngữ cảnh, nó càng trở nên tốt hơn.

## Nhờ pi-web làm việc

Sau khi chạy `pi install npm:@ygncode/pi-web@beta`, các phiên có thể nói chuyện với chính pi-web.
Thử:

- “Thêm lịch trình lúc 2 giờ sáng giờ Singapore để tóm tắt hộp thư đến của tôi”
- “Liệt kê các lịch trình pi-web của tôi”
- “Tạm dừng lịch trình hộp thư đến”
- “Ghi điều này vào ghi chú”
- “Chuyển pi-web sang chế độ tối / tắt tự động đặt tiêu đề”

Skill **/skill:pi-web-schedule** đi kèm sẽ biến điều đó thành một lịch trình pi-web thực sự (chính là những lịch trình bạn chỉnh sửa tại `/schedules`). Mỗi lần kích hoạt sẽ bắt đầu một phiên **mới**, vì vậy các hướng dẫn phải tự đứng độc lập — “tóm tắt thư chưa đọc trong ~/inbox” thì hoạt động; “tiếp tục những gì chúng ta đang làm” thì không.

Các lịch trình chỉ chạy khi pi-web đang chạy.

---

> 💡 **Mẹo:** Hãy bắt đầu đơn giản. Chỉ vài dòng về bạn là ai và bạn muốn trợ lý cư xử như thế nào. Lặp lại theo thời gian khi bạn học được điều gì hiệu quả.
