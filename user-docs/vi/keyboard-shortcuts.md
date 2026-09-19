# Phím tắt bàn phím

## Trang danh sách (`/`)

### Cuộn trang (kiểu vim)

Các phím tắt kiểu vim này hoạt động trên mọi trang khi tiêu điểm **không** nằm trong phần tử input, textarea hoặc contenteditable.

| Phím tắt | Hành động |
|----------|--------|
| `j` | Cuộn xuống 300px |
| `k` | Cuộn lên 300px |
| `g g` | Cuộn lên đầu trang |
| `G` (Shift+G) | Cuộn xuống cuối trang |
| `Escape` | Bỏ tiêu điểm khỏi ô nhập đang hoạt động để điều hướng j/k hoạt động |

### Lệnh trên trang danh sách

| Phím tắt | Ngữ cảnh | Hành động |
|----------|---------|--------|
| `⌘K` / `Ctrl+K` | Cấp trang | Mở bảng tìm kiếm/phiên |
| `⌘,` / `Ctrl+,` | Cấp trang | Mở cài đặt |
| `⌘⇧L` / `Ctrl+Shift+L` | Cấp trang | Bật/tắt giao diện hệ thống (sáng/tối) |
| `Escape` | Cấp trang | Đóng bảng, menu hoặc modal |
| `Enter` | Ô nhập đường dẫn phiên mới | Tạo phiên mới |

> `⌘K` / `Ctrl+K` cũng là phím tắt "tập trung thanh địa chỉ" của Chrome. Trình duyệt có thể chặn phím này trừ khi tiêu điểm nằm trong ô nhập văn bản.

## Trang chi tiết phiên (`/session?id=...`)

### Cuộn trang (kiểu vim)

Các phím này hoạt động trên cả trang danh sách lẫn trang phiên khi tiêu điểm **không** nằm trong phần tử input, textarea hoặc contenteditable.

| Phím tắt | Hành động |
|----------|--------|
| `j` | Cuộn xuống 300px |
| `k` | Cuộn lên 300px |
| `g g` | Cuộn lên đầu trang |
| `G` (Shift+G) | Cuộn xuống cuối trang |
| `I` (Shift+I) | Tập trung vào ô soạn tin nhắn |
| `Escape` | Bỏ tiêu điểm khỏi ô nhập đang hoạt động để điều hướng j/k hoạt động |

### Thanh bên & điều hướng

| Phím tắt | Ngữ cảnh | Hành động |
|----------|---------|--------|
| `⌘B` / `Ctrl+B` | Cấp trang | Hiện/ẩn thanh bên |
| `⌘K` / `Ctrl+K` | Cấp trang | Mở bảng danh sách phiên |
| `⌘T` / `Ctrl+T` | Cấp trang | Phiên mới |
| `⌘/` / `Ctrl+/` | Cấp trang | Hiển thị modal phím tắt |
| `⌘,` / `Ctrl+,` | Cấp trang | Mở cài đặt |
| `⌘⇧L` / `Ctrl+Shift+L` | Cấp trang | Bật/tắt giao diện hệ thống (sáng/tối) |
| `⌘⇧N` / `Ctrl+Shift+N` | Cấp trang | Hiện/ẩn thanh bên nháp / ghi chú |

> `⌘K` và `⌘T` cũng là phím tắt của trình duyệt (tập trung thanh địa chỉ / thẻ mới). Trình duyệt có thể chặn chúng trừ khi tiêu điểm nằm trong ô nhập văn bản.

### Soạn tin nhắn

| Phím tắt | Ngữ cảnh | Hành động |
|----------|---------|--------|
| `Enter` | Ô soạn tin nhắn | Gửi tin nhắn |
| `Shift+Enter` | Ô soạn tin nhắn | Chèn dòng mới |
| `Shift+Tab` | Ô soạn tin nhắn | Chuyển sang mức suy nghĩ kế tiếp (`off` → `minimal` → … → `xhigh` → `off`) |
| `Ctrl+I` / `Ctrl+L` | Ô soạn tin nhắn | Mở popup chọn mô hình (gõ để lọc, Enter để chọn, tiêu điểm quay lại ô soạn) |

### Chuyển đổi hiển thị mục nhập

| Phím tắt | Ngữ cảnh | Hành động |
|----------|---------|--------|
| `t` | Khi tiêu điểm **không** nằm trong ô input/textarea | Hiện/ẩn phần suy nghĩ |
| `o` | Khi tiêu điểm **không** nằm trong ô input/textarea | Hiện/ẩn công cụ |
| `p` | Khi tiêu điểm **không** nằm trong ô input/textarea | Hiện/ẩn kết quả công cụ |

### Bảng, menu & bảng toàn màn hình

| Phím tắt | Ngữ cảnh | Hành động |
|----------|---------|--------|
| `Escape` | Cấp trang | Đóng bất kỳ bảng, menu hoặc bảng toàn màn hình nào đang mở |
| `⌘K` / `Ctrl+K` | Cấp trang | Mở bảng danh sách phiên |
| `ArrowUp` / `ArrowDown` | Bảng danh sách phiên | Điều hướng kết quả phiên |
| `Enter` | Bảng danh sách phiên | Mở phiên đang chọn (hoặc phiên đầu tiên) |
| `ArrowUp` / `ArrowDown` | Popup chọn mô hình | Điều hướng danh sách mô hình |
| `Enter` | Popup chọn mô hình | Chọn mô hình đang được tô sáng |
| `ArrowUp` / `ArrowDown` | Modal phân nhánh | Điều hướng tin nhắn |
| `Enter` | Modal phân nhánh | Phân nhánh từ tin nhắn đang được tô sáng |
| `Tab` | Bảng toàn màn hình | Xoay vòng tiêu điểm trong bảng |
| `Escape` | Bảng toàn màn hình | Đóng bảng |
