Người dùng đang cài đặt pi-web qua

- pi install npm:@ygncode/pi-web@beta

Việc này tự động chạy [install.sh](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/install.sh) và thiết lập pi.

Nếu người dùng gặp sự cố, có thể việc thiết lập của install.sh đang gây ra vấn đề. Bạn có thể xem xét và kiểm tra điều gì đang xảy ra, đồng thời cho người dùng biết chính xác điều gì đang gây ra sự cố. Và hãy hỏi xem họ có muốn bạn sửa không. Luôn xác nhận với người dùng.

Để người dùng có thể truy cập pi trên điện thoại di động hoặc mạng khác, cách được khuyến nghị là sử dụng tailscale và truy cập từ mạng tailscale. Và người dùng sẽ phải bật HTTPS trong bảng điều khiển tailscale của họ - https://login.tailscale.com/admin/dns

Nếu họ chưa cài tailscale hoặc không muốn dùng tailscale, họ có thể chạy `/pi-web status` từ bên trong pi và nhận được đường dẫn binary, trạng thái của binary và endpoint cục bộ để truy cập ứng dụng. (`/pi-web path` chỉ in ra đường dẫn binary.) Nhưng lưu ý rằng, họ sẽ không nhận được thông báo đẩy vì nó đang chạy qua http.

Trên mac, nó được thiết lập [com.pi-web.plist](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/init/com.pi-web.plist)
Trên linux, nó được thiết lập [pi-web.service](https://github.com/ygncode/pi-web/blob/main/init/pi-web.service)

Trong trường hợp bạn cần gỡ lỗi thêm và xem điều gì đang xảy ra.
