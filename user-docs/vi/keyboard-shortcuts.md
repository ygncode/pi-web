# Phím Tắt

## Trang chỉ mục (`/`)

### Cuộn trang (kiểu vim)

Các phím tắt kiểu vim tương tự hoạt động trên tất cả các trang khi tiêu điểm **không** nằm trong phần tử input, textarea hoặc contenteditable.

| Phím tắt | Hành động |
|----------|--------|
| `j` | Cuộn xuống 300px |
| `k` | Cuộn lên 300px |
| `g g` | Cuộn lên đầu trang |
| `G` (Shift+G) | Cuộn xuống cuối trang |
| `Escape` | Làm mờ tiêu điểm khỏi input đang hoạt động để điều hướng j/k hoạt động |

### Lệnh trang chỉ mục

| Phím tắt | Ngữ cảnh | Hành động |
|----------|---------|--------|
| `⌘K` / `Ctrl+K` | Cấp trang | Mở bảng tìm kiếm/phiên |
| `⌘⇧L` / `Ctrl+Shift+L` | Cấp trang | Chuyển đổi giao diện hệ thống (sáng/tối) |
| `Escape` | Cấp trang | Đóng bảng, menu hoặc modal |
| `Enter` | Ô nhập đường dẫn phiên mới | Tạo phiên mới |

> `⌘K` / `Ctrl+K` cũng là phím tắt "tập trung thanh địa chỉ" của Chrome. Trình duyệt có thể chặn phím này trừ khi tiêu điểm đang nằm trong ô nhập văn bản.

## Trang chi tiết phiên (`/session?id=...`)

### Cuộn trang (kiểu vim)

Các phím này hoạt động trên cả trang chỉ mục và trang phiên khi tiêu điểm **không** nằm trong phần tử input, textarea hoặc contenteditable.

| Phím tắt | Hành động |
|----------|--------|
| `j` | Cuộn xuống 300px |
| `k` | Cuộn lên 300px |
| `g g` | Cuộn lên đầu trang |
| `G` (Shift+G) | Cuộn xuống cuối trang |
| `I` (Shift+I) | Tập trung vào textarea soạn tin nhắn |
| `Escape` | Làm mờ tiêu điểm khỏi input đang hoạt động để điều hướng j/k hoạt động |

### Thanh bên & điều hướng

| Phím tắt | Ngữ cảnh | Hành động |
|----------|---------|--------|
| `⌘B` / `Ctrl+B` | Cấp trang | Chuyển đổi hiển thị thanh bên |
| `⌘K` / `Ctrl+K` | Cấp trang | Mở bảng danh sách phiên |
| `⌘T` / `Ctrl+T` | Cấp trang | Phiên mới |
| `⌘⇧L` / `Ctrl+Shift+L` | Cấp trang | Chuyển đổi giao diện hệ thống (sáng/tối) |
| `⌘⇧N` / `Ctrl+Shift+N` | Cấp trang | Chuyển đổi thanh bên ghi chú / nháp |

> `⌘K` và `⌘T` cũng là phím tắt của trình duyệt (tập trung thanh địa chỉ / tab mới). Trình duyệt có thể chặn các phím này trừ khi tiêu điểm đang nằm trong ô nhập văn bản.

### Soạn tin nhắn

| Phím tắt | Ngữ cảnh | Hành động |
|----------|---------|--------|
| `Enter` | Textarea trò chuyện | Gửi tin nhắn |
| `Shift+Enter` | Textarea trò chuyện | Chèn dòng mới |
| `Shift+Tab` | Textarea trò chuyện | Chuyển sang mức suy nghĩ tiếp theo (`off` → `minimal` → … → `xhigh` → `off`) |
| `Ctrl+I` / `Ctrl+L` | Textarea trò chuyện | Mở popup chọn mô hình (gõ để lọc, Enter để chọn, tiêu điểm trở về textarea) |

### Chuyển đổi hiển thị mục nhập

| Phím tắt | Ngữ cảnh | Hành động |
|----------|---------|--------|
| `t` | Khi tiêu điểm **không** nằm trong input/textarea | Chuyển đổi hiển thị suy nghĩ |
| `o` | Khi tiêu điểm **không** nằm trong input/textarea | Chuyển đổi hiển thị công cụ |
| `p` | Khi tiêu điểm **không** nằm trong input/textarea | Chuyển đổi hiển thị kết quả công cụ |

### Bảng, menu & bảng trượt

| Phím tắt | Ngữ cảnh | Hành động |
|----------|---------|--------|
| `Escape` | Cấp trang | Đóng mọi bảng, menu hoặc bảng trượt đang mở |
| `⌘K` / `Ctrl+K` | Cấp trang | Mở bảng danh sách phiên |
| `ArrowUp` / `ArrowDown` | Bảng danh sách phiên | Điều hướng kết quả phiên |
| `Enter` | Bảng danh sách phiên | Mở phiên đã chọn (hoặc phiên đầu tiên) |
| `ArrowUp` / `ArrowDown` | Popup chọn mô hình | Điều hướng danh sách mô hình |
| `Enter` | Popup chọn mô hình | Chọn mô hình được đánh dấu |
| `ArrowUp` / `ArrowDown` | Modal phân nhánh | Điều hướng tin nhắn |
| `Enter` | Modal phân nhánh | Phân nhánh từ tin nhắn được đánh dấu |
| `Tab` | Bảng trượt toàn màn hình | Chuyển tiêu điểm trong bảng trượt |
| `Escape` | Bảng trượt toàn màn hình | Đóng bảng trượt |
