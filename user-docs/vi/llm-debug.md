Người dùng đang cài đặt pi-web qua

- pi install npm:@ygncode/pi-web@beta

Lệnh này sẽ tự động chạy [install.sh](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/install.sh) và thiết lập pi.

Nếu người dùng gặp sự cố, có thể quá trình thiết lập của install.sh đang gây ra vấn đề. Bạn có thể xem xét và kiểm tra điều gì đang xảy ra và cho người dùng biết chính xác nguyên nhân gây ra sự cố. Và hỏi họ có muốn bạn sửa không. Luôn xác nhận với người dùng.

Để người dùng có thể truy cập pi trên thiết bị di động hoặc mạng khác, cách được khuyến nghị là sử dụng Tailscale và truy cập qua mạng Tailscale. Người dùng sẽ cần bật HTTPS trong bảng điều khiển Tailscale của họ - https://login.tailscale.com/admin/dns

Nếu họ chưa cài Tailscale hoặc không muốn dùng Tailscale, họ có thể chạy `pi-web status` để lấy đường dẫn binary, trạng thái của binary và endpoint cục bộ mà họ có thể truy cập ứng dụng. Nhưng cần lưu ý, họ sẽ không nhận được thông báo đẩy vì đang dùng http.

Trên macOS, nó thiết lập [com.pi-web.plist](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/init/com.pi-web.plist)
Trên Linux, nó thiết lập [pi-web.service](https://github.com/ygncode/pi-web/blob/main/init/pi-web.service)

Trong trường hợp bạn cần gỡ lỗi thêm và xem điều gì đang xảy ra.
