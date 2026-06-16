# pi-web làm Trợ Lý Cá Nhân của Bạn

pi-web không chỉ để lập trình — bạn có thể biến nó thành **trợ lý AI cá nhân** sống trên máy tính của bạn, giống như có OpenClaw hoặc Hermes của riêng mình.

## Cách hoạt động

Bạn tạo một thư mục riêng trên máy — đó là nơi trợ lý của bạn sống. Bên trong, bạn thêm vào một tệp `APPEND_SYSTEM.md` để định nghĩa trợ lý của bạn là ai, biết những gì và hành xử ra sao. pi-web cung cấp cho bạn một giao diện trò chuyện đẹp mắt để nói chuyện với nó từ bất kỳ thiết bị nào.

## Từng bước

### 1. Tạo thư mục trợ lý

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

pi tự động thêm nội dung này vào system prompt của mỗi cuộc trò chuyện, để trợ lý của bạn luôn biết bạn là ai và cách giúp đỡ.

### 3. Bắt đầu một phiên trong thư mục đó

Trong pi-web, tạo một phiên mới trỏ đến `~/my-assistant/` (hoặc tên bạn đã đặt). Vậy là xong — bạn đang trò chuyện với trợ lý cá nhân của mình.

### 4. Dùng từ mọi nơi

Cài đặt pi-web dưới dạng PWA trên điện thoại, máy tính bảng hoặc laptop của bạn. Trợ lý của bạn luôn ở đó — hỏi bất cứ điều gì, bất cứ lúc nào.

## Ý tưởng cho trợ lý của bạn

| Vai trò | Nội dung nên có trong APPEND_SYSTEM.md |
|---|---|
| 🧠 **Huấn luyện viên cuộc sống** | Mục tiêu của bạn, thói quen đang rèn luyện, gợi ý viết nhật ký |
| 🏠 **Quản lý nhà cửa** | Định dạng danh sách mua sắm, sở thích của các thành viên gia đình, lên kế hoạch bữa ăn |
| 💼 **Bạn đồng hành công việc** | Vai trò của bạn, dự án hiện tại, định dạng ghi chú cuộc họp, bối cảnh công ty |
| 📚 **Bạn học** | Những gì bạn đang học, phong cách giải thích ưa thích, chế độ kiểm tra |
| ✍️ **Trợ lý viết lách** | Phong cách viết của bạn, giọng điệu ưa thích, các định dạng thường dùng |

## Thêm ngữ cảnh

Bạn có thể đặt bất cứ thứ gì vào thư mục trợ lý để giúp pi hữu ích hơn:

- `notes/` — các tệp tham khảo mà trợ lý có thể đọc
- `context.md` — thông tin nền về cuộc sống hoặc công việc của bạn
- `projects.md` — các dự án hiện tại và trạng thái của chúng

pi có thể đọc các tệp trong thư mục, vì vậy bạn càng cung cấp nhiều ngữ cảnh, nó càng trở nên tốt hơn.

---

> 💡 **Mẹo:** Bắt đầu đơn giản. Chỉ vài dòng về bạn là ai và bạn muốn trợ lý hành xử như thế nào. Dần dần cải thiện khi bạn hiểu điều gì hiệu quả.
