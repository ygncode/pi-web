# Cài đặt & Sử dụng

## Tính năng

### Điều khiển từ xa

- Tiếp tục bất kỳ phiên nào từ trình duyệt với tệp đính kèm văn bản hoặc hình ảnh
- Khởi tạo phiên mới cho bất kỳ đường dẫn dự án nào, ngay từ giao diện web
- Chuyển đổi mô hình và chọn mức độ suy nghĩ ngay trong trình duyệt, theo từng phiên
- Trạng thái worker theo từng phiên (rảnh / đang chạy / lỗi) với tự động phục hồi khi gặp sự cố
- Nhiều phiên chạy song song — khởi động công việc trong phiên này, theo dõi luồng phiên khác
- `PI_WEB_TOKEN` để phơi mạng LAN an toàn — mặc định bắt buộc cho mọi ràng buộc non-loopback tường minh

### Đọc phiên

- Duyệt phiên trên các dự án với bộ lọc, tìm kiếm và điều hướng nhánh đầy đủ
- Cập nhật gia tăng trực tiếp khi pi vẫn đang chạy (qua fsnotify; độ trễ ~ms)
- Chế độ theo dõi để bám đuôi các phiên đang hoạt động
- Liên kết sâu đến từng tin nhắn
- Tải phiên dưới dạng JSONL
- Chia sẻ ảnh chụp tĩnh dưới dạng GitHub Gists bí mật
- Các tiện ích mở rộng pi `/web`, `/remote`, `/refresh`, `/pi-web token` và `/pi-web set-token` để mở phiên, QR từ xa, đồng bộ phiên và quản lý token

## Yêu cầu

- [Go](https://go.dev) 1.25+
- `pi` có trong `PATH` của bạn để trò chuyện trên trình duyệt / chuyển đổi mô hình
- Tùy chọn: `gh` để chia sẻ

## Cài đặt

### Gói Pi (khuyến nghị)

```bash
pi install npm:@ygncode/pi-web@beta
```

Một lệnh duy nhất này:
- Cài đặt gói npm pi vào thư mục gói của pi
- Chạy script `postinstall` của gói (`bash install.sh`)
- Tải xuống tệp nhị phân pi-web phù hợp với phiên bản gói và nền tảng của bạn từ GitHub Releases
- Cài đặt vào `~/.pi/agent/bin/pi-web`
- Thiết lập tự động khởi động khi đăng nhập (launchd trên macOS, systemd trên Linux)
- Đăng ký các lệnh pi `/web`, `/remote`, `/refresh`, `/pi-web token` và `/pi-web set-token`

Tự động đặt tiêu đề phiên được tích hợp sẵn trong pi-web (không phải tiện ích mở rộng) và được cấu hình trên trang `/settings`. Tính năng này được bật theo mặc định: pi-web tự động đặt tên phiên bằng heuristic từ miễn phí có sẵn (không dùng AI), đặt lại tiêu đề cho mỗi tin nhắn mới. Bạn có thể chuyển sang đặt tiêu đề một lần mỗi phiên và/hoặc chọn một mô hình để viết tiêu đề thông minh hơn thay vì dùng heuristic.

Trên Linux, tự động khởi động được cấu hình dưới dạng dịch vụ systemd người dùng tại `~/.config/systemd/user/pi-web.service`. Trình cài đặt ghi lại `ExecStart` của nó thành đường dẫn tệp nhị phân thực tế đã cài đặt. Nếu Tailscale khả dụng khi chạy, pi-web công bố máy chủ localhost với Tailscale Serve HTTPS. Nếu systemd người dùng không khả dụng, hãy chạy thủ công với `~/.pi/agent/bin/pi-web -o`.

Để chỉ cài đặt cho một dự án cụ thể (chia sẻ với nhóm qua `.pi/settings.json`):

```bash
pi install -l npm:@ygncode/pi-web@beta
```

Sau đó khởi động lại pi (hoặc chạy `/reload`), và sử dụng `/web`, `/pi-web`, `/remote`, `/refresh`. Quản lý token truy cập của bạn với `/pi-web token` và `/pi-web set-token`.

Nếu npm hủy bỏ với `ENOTEMPTY` khi đổi tên `@ygncode/pi-web`, hãy xóa các thư mục sao lưu ẩn cũ của npm và cài đặt lại kênh beta:

```bash
rm -rf ~/.pi/agent/npm/node_modules/@ygncode/.pi-web-*
pi install npm:@ygncode/pi-web@beta
```

### Cài đặt nhanh (không cần công cụ build)

```bash
curl -fsSL https://raw.githubusercontent.com/ygncode/pi-web/main/install.sh | bash
```

Lệnh này tải xuống tệp nhị phân pi-web mới nhất, cài đặt vào `/usr/local/bin` và thiết lập tự động khởi động khi đăng nhập. Không cần Go, Node hoặc pi.

### Tải xuống tệp nhị phân

Các tệp nhị phân dựng sẵn được đính kèm với mỗi [GitHub Release](https://github.com/ygncode/pi-web/releases).

```bash
# macOS (Apple Silicon)
curl -L -o pi-web https://github.com/ygncode/pi-web/releases/latest/download/pi-web-darwin-arm64
chmod +x pi-web

# macOS (Intel)
curl -L -o pi-web https://github.com/ygncode/pi-web/releases/latest/download/pi-web-darwin-amd64
chmod +x pi-web

# Linux (amd64)
curl -L -o pi-web https://github.com/ygncode/pi-web/releases/latest/download/pi-web-linux-amd64
chmod +x pi-web

# Linux (arm64)
curl -L -o pi-web https://github.com/ygncode/pi-web/releases/latest/download/pi-web-linux-arm64
chmod +x pi-web
```

Sau đó di chuyển nó vào PATH của bạn:

```bash
cp pi-web ~/.pi/agent/bin/
# hoặc toàn hệ thống:
sudo cp pi-web /usr/local/bin/
```

### Dựng từ mã nguồn

```bash
git clone https://github.com/ygncode/pi-web.git
cd pi-web
make build   # dựng gói Vite, sau đó nhúng vào tệp nhị phân Go

# tùy chọn: đưa vào PATH
cp pi-web ~/.pi/agent/bin/
```

Gói frontend được nhúng bởi `web/assets_embed.go`, vì vậy `go build` cần
`web/dist` tồn tại trước. `make build` thực hiện cả hai bước theo thứ tự; nếu bạn
dựng thủ công, hãy chạy `npm --prefix web install && npm --prefix web run build`
trước `go build ./cmd/pi-web`.

## Gỡ cài đặt

```bash
pi remove npm:@ygncode/pi-web@beta
```

Lệnh này chạy script `preuninstall` của gói (`bash uninstall.sh`), dừng
phiên bản đang chạy và xóa:

- tệp nhị phân pi-web (`~/.pi/agent/bin/pi-web`, hoặc `/usr/local/bin/pi-web` cho cài đặt độc lập)
- tệp phiên bản (`~/.pi/agent/pi-web-version`)
- tệp trạng thái thời gian chạy (`~/.pi/agent/pi-web/pi-web-state.json`)
- cấu hình tự động khởi động (plist launchd trên macOS, dịch vụ systemd người dùng trên Linux)

Dữ liệu của bạn được giữ nguyên để lần cài đặt lại sau này tiếp tục từ nơi bạn đã dừng:
`~/.pi/agent/pi-web.sqlite`, `~/.pi/agent/pi-web-memory.sqlite`, các tệp phiên
của bạn trong `~/.pi/agent/sessions/`, và `~/.config/pi-web/env` (bao gồm
`PI_WEB_TOKEN`). Xóa thủ công những tệp đó nếu bạn muốn bắt đầu lại từ đầu.

## Sử dụng

```bash
# Khởi động trên cổng mặc định (31415)
pi-web

# Khởi động và mở trình duyệt
pi-web -o

# Cổng tùy chỉnh
pi-web -p 8080

# Ghi đè máy chủ ràng buộc (loopback không xác thực theo mặc định)
pi-web --host 127.0.0.1

# Ràng buộc non-loopback yêu cầu token — pi-web từ chối khởi động nếu không có
PI_WEB_TOKEN=$(openssl rand -hex 16) pi-web --host 192.168.1.50
```

Theo mặc định, pi-web ràng buộc vào `127.0.0.1`. Nếu Tailscale đang chạy với MagicDNS, pi-web cũng chạy `tailscale serve --bg --https=<port> http://127.0.0.1:<port>` và in ra URL tailnet HTTPS. Mọi ràng buộc non-loopback tường minh đều yêu cầu `PI_WEB_TOKEN` được đặt; truyền `--insecure` để ghi đè khi kiểm thử cục bộ.

## Truy cập từ xa

Để pi-web lắng nghe cục bộ, sau đó sử dụng URL Tailscale HTTPS được in ra từ điện thoại hoặc máy tính xách tay trên tailnet.

Trên macOS, hãy cài đặt và mở Tailscale theo cách tương tác, chấp thuận lời nhắc quản trị viên và đăng nhập. Sau đó chạy `/pi-web restart`, rồi chạy `/remote`.

Trên Linux, cho phép người dùng của bạn quản lý Tailscale trước khi cài đặt/chạy pi-web, nếu không `tailscale serve` có thể yêu cầu sudo và tự động khởi động có thể thất bại:

```bash
sudo tailscale set --operator=$USER
```

```bash
# 1. Khởi động pi-web
pi-web

# 2. Từ bất kỳ thiết bị nào khác được kết nối Tailscale, mở URL
#    "Tailscale HTTPS" được in ra.
```

> Theo mặc định, pi-web từ chối ràng buộc vào địa chỉ non-loopback trừ khi `PI_WEB_TOKEN` được đặt — bất kỳ ai có thể truy cập địa chỉ ràng buộc đều có thể xem phiên và gửi chỉ thị cho pi. Để ghi đè biện pháp bảo vệ này khi kiểm thử mạng cục bộ, hãy truyền `--insecure`. **Đừng sử dụng `--insecure` trên Tailscale hoặc bất kỳ địa chỉ nào có thể truy cập từ bên ngoài máy của bạn.**
>
> Máy khách có thể truyền token qua header `Authorization: Bearer <token>`, header `X-Pi-Token`, hoặc một lần qua `?token=<token>` (thiết lập cookie `pi_token` cho các yêu cầu tiếp theo). Token được truyền qua `?token=` sẽ xuất hiện trong lịch sử trình duyệt, nhật ký truy cập máy chủ và header `Referer` từ bất kỳ liên kết nào trên trang — ưu tiên dạng header cho bất kỳ điều gì ngoài dấu trang ban đầu.

## Trò chuyện trên trình duyệt

Mở trang phiên và sử dụng trình soạn thảo ở dưới cùng để tiếp tục chính xác phiên đó.

- `Enter` gửi, `Shift+Enter` chèn dòng mới
- Kéo-thả hoặc dán hình ảnh trực tiếp vào trình soạn thảo
- Bộ chọn mô hình và bộ chọn mức độ suy nghĩ nằm trong tiêu đề — thay đổi áp dụng ngay lập tức cho worker pi bên dưới
- Mỗi phiên hoạt động có worker `pi --mode rpc` riêng, vì vậy các phiên khác nhau không chặn nhau

## Chia sẻ phiên

Nhấp **Share** trên trang phiên để tạo GitHub Gist bí mật.

Yêu cầu:
- `gh` đã cài đặt
- `gh auth login` đã hoàn tất

Chia sẻ trả về:
- URL gist bí mật
- URL xem trước tại `https://pi.dev/session/#<gistId>`

Các gist được chia sẻ là ảnh chụp tĩnh và không cập nhật trực tiếp.

## Tự động khởi động khi đăng nhập

### macOS

```bash
cp init/com.pi-web.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.pi-web.plist
```

### Linux (systemd)

```bash
# Cài đặt dịch vụ systemd người dùng
mkdir -p ~/.config/systemd/user
cp init/pi-web.service ~/.config/systemd/user/

# Tùy chọn: đặt PI_WEB_TOKEN của bạn cho ràng buộc non-loopback
# (hoặc sử dụng /pi-web set-token <token> từ bên trong pi)
mkdir -p ~/.config/pi-web
echo 'PI_WEB_TOKEN=your-token-here' > ~/.config/pi-web/env

# Kích hoạt và khởi động
systemctl --user daemon-reload
systemctl --user enable --now pi-web.service

# Kiểm tra trạng thái
systemctl --user status pi-web.service

# Xem nhật ký
journalctl --user -u pi-web.service -f
```

> Để dịch vụ khởi động khi khởi động máy (trước khi đăng nhập), hãy sử dụng dịch vụ hệ thống thay thế:
> sao chép `init/pi-web.service` vào `/etc/systemd/system/` và sử dụng `sudo systemctl`.
