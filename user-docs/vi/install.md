# Cài đặt & Sử dụng

## Tính năng

### Điều khiển từ xa

- Tiếp tục bất kỳ phiên nào từ trình duyệt với tệp đính kèm văn bản hoặc hình ảnh
- Bắt đầu một phiên hoàn toàn mới với bất kỳ đường dẫn dự án nào, ngay từ giao diện web
- Chuyển đổi model và bộ chọn mức suy nghĩ ngay trong trình duyệt, theo từng phiên
- Trạng thái worker theo từng phiên (nhàn rỗi / đang chạy / lỗi) với khả năng tự phục hồi khi gặp sự cố
- Nhiều phiên chạy song song — khởi động công việc ở phiên này, theo dõi luồng ở phiên khác
- `PI_WEB_TOKEN` để phơi bày an toàn trên LAN — bắt buộc theo mặc định cho bất kỳ ràng buộc không phải loopback nào được chỉ định rõ ràng

### Đọc phiên

- Duyệt các phiên trên nhiều dự án với bộ lọc, tìm kiếm và điều hướng nhánh đầy đủ
- Cập nhật tăng dần trực tiếp trong khi pi vẫn đang chạy (thông qua fsnotify; độ trễ ~ms)
- Chế độ theo dõi (follow) để bám theo các phiên đang hoạt động
- Liên kết sâu đến từng tin nhắn
- Tải phiên dưới dạng JSONL
- Chia sẻ ảnh chụp tĩnh dưới dạng GitHub Gists bí mật
- Các tiện ích mở rộng pi `/web`, `/remote`, `/refresh`, `/pi-web token` và `/pi-web set-token` để mở phiên, mã QR từ xa, đồng bộ phiên và quản lý token
- `/skill:pi-web-schedule`, `/skill:pi-web-notes`, `/skill:pi-web-settings` (`pi-web-ctl`) để một phiên có thể quản lý lịch trình, sổ tay dự án và cài đặt bằng ngôn ngữ tự nhiên

## Yêu cầu

- [Go](https://go.dev) 1.25+ (chỉ dành cho việc build từ mã nguồn)
- `pi` trong `PATH` của bạn để trò chuyện trên trình duyệt / chuyển đổi model
- Tùy chọn: `gh` để chia sẻ
- Trên Windows: pi cần một shell bash cho công cụ shell của nó — [Git for Windows](https://git-scm.com/download/win) là đủ (xem tài liệu Windows của pi)

## Cài đặt

### Gói Pi (khuyến nghị)

```bash
pi install npm:@ygncode/pi-web@beta
```

Lệnh duy nhất này:

- Cài đặt gói pi npm vào thư mục gói của pi
- Chạy script `postinstall` của gói (`install.sh`, hoặc `install.ps1` trên Windows)
- Tải xuống tệp nhị phân pi-web tương ứng với phiên bản gói và nền tảng của bạn từ GitHub Releases
- Cài đặt nó vào `~/.pi/agent/bin/pi-web` (`pi-web.exe` trên Windows)
- Thiết lập tự động khởi động khi đăng nhập (launchd trên macOS, systemd trên Linux, bộ khởi chạy Run-key trên Windows)
- Đăng ký các lệnh pi `/web`, `/remote`, `/refresh`, `/pi-web token` và `/pi-web set-token`

Tính năng tự đặt tiêu đề phiên được tích hợp sẵn trong pi-web (không phải trong tiện ích mở rộng) và được cấu hình trên trang `/settings`. Nó được bật theo mặc định: pi-web tự động đặt tên phiên bằng một heuristic từ vựng tích hợp miễn phí (không dùng AI), đặt lại tiêu đề trên mỗi tin nhắn mới. Bạn có thể chuyển sang đặt tiêu đề một lần cho mỗi phiên, và/hoặc chọn một model để viết các tiêu đề thông minh hơn thay vì dùng heuristic.

Trên Linux, tự động khởi động được cấu hình dưới dạng một dịch vụ systemd người dùng tại `~/.config/systemd/user/pi-web.service`. Trình cài đặt ghi lại `ExecStart` của nó thành đường dẫn tệp nhị phân thực tế đã cài đặt. Nếu Tailscale khả dụng khi chạy, pi-web sẽ xuất bản máy chủ localhost bằng Tailscale Serve HTTPS. Nếu systemd người dùng không khả dụng, hãy chạy thủ công bằng `~/.pi/agent/bin/pi-web -o`.

Để chỉ cài đặt cho một dự án cụ thể (chia sẻ với nhóm của bạn qua `.pi/settings.json`):

```bash
pi install -l npm:@ygncode/pi-web@beta
```

Sau đó khởi động lại pi (hoặc chạy `/reload`), rồi dùng `/web`, `/pi-web`, `/remote`, `/refresh`. Quản lý token truy cập của bạn bằng `/pi-web token` và `/pi-web set-token`.

Nếu npm hủy bỏ với lỗi `ENOTEMPTY` khi đổi tên `@ygncode/pi-web`, hãy xóa các thư mục sao lưu ẩn cũ của npm và cài đặt lại kênh beta:

```bash
rm -rf ~/.pi/agent/npm/node_modules/@ygncode/.pi-web-*
pi install npm:@ygncode/pi-web@beta
```

### Cài đặt nhanh (không cần công cụ build)

macOS / Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/ygncode/pi-web/main/install.sh | bash
```

Windows (PowerShell):

```powershell
irm https://raw.githubusercontent.com/ygncode/pi-web/main/install.ps1 | iex
```

Lệnh này tải xuống tệp nhị phân pi-web mới nhất, cài đặt vào `/usr/local/bin` (`~/.pi/agent/bin` trên Windows) và thiết lập tự động khởi động khi đăng nhập. Không cần Go, Node hoặc pi.

### Tải tệp nhị phân

Các tệp nhị phân dựng sẵn được đính kèm vào mỗi [GitHub Release](https://github.com/ygncode/pi-web/releases).

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

```powershell
# Windows (x64)
irm -OutFile pi-web.exe https://github.com/ygncode/pi-web/releases/latest/download/pi-web-windows-amd64.exe

# Windows (ARM64)
irm -OutFile pi-web.exe https://github.com/ygncode/pi-web/releases/latest/download/pi-web-windows-arm64.exe
```

Sau đó di chuyển nó vào PATH của bạn:

```bash
cp pi-web ~/.pi/agent/bin/
# or system-wide:
sudo cp pi-web /usr/local/bin/
```

### Build từ mã nguồn

```bash
git clone https://github.com/ygncode/pi-web.git
cd pi-web
make build   # builds the Vite bundle, then embeds it into the Go binary

# optional: put it on PATH
cp pi-web ~/.pi/agent/bin/
```

Gói frontend được nhúng bởi `web/assets_embed.go`, vì vậy `go build` cần
`web/dist` tồn tại trước. `make build` thực hiện cả hai bước theo thứ tự; nếu bạn
build thủ công, hãy chạy `npm --prefix web install && npm --prefix web run build` trước
`go build ./cmd/pi-web`.

### Phát triển song song với phiên bản đã cài đặt

Để phiên bản đã cài đặt tiếp tục chạy trên cổng `31415`, sau đó khởi động bản
checkout mã nguồn ở chế độ phát triển:

```bash
make dev
```

Mở `http://127.0.0.1:31416`. `make dev` thiết lập môi trường phát triển nội bộ
`PI_WEB_DEV=1`, nhờ đó bản checkout mã nguồn chia sẻ phiên, cài đặt và dữ liệu
SQLite với phiên bản đã cài đặt trong khi vẫn giữ một khóa runtime và tệp trạng
thái phát triển riêng biệt. Các phiên bản đã cài đặt thông thường và phiên bản
khởi chạy thủ công không thay đổi và vẫn giữ hành vi một phiên bản duy nhất ban
đầu.

Để tránh công việc tự động bị trùng lặp, chế độ phát triển không chạy vòng lặp
lịch trình, bộ rút hàng đợi trò chuyện, tự đặt tiêu đề hay thông báo đẩy. Các yêu
cầu trực tiếp được thực hiện qua giao diện phát triển vẫn hoạt động. Không điều
khiển cùng một phiên trò chuyện từ cả hai phiên bản cùng lúc; mỗi tiến trình có
trình quản lý worker RPC riêng.

`make dev` yêu cầu [Air](https://github.com/air-verse/air) để hot reload Go:

```bash
go install github.com/air-verse/air@latest
```

`PI_WEB_DEV` là cơ chế nội bộ của bộ khung phát triển, không phải chế độ đa
phiên bản sản xuất được hỗ trợ.

## Gỡ cài đặt

```bash
pi remove npm:@ygncode/pi-web@beta
```

Lệnh này chạy script `preuninstall` của gói (`uninstall.sh`, hoặc `uninstall.ps1`
trên Windows), dừng phiên bản đang chạy và xóa:

- tệp nhị phân pi-web (`~/.pi/agent/bin/pi-web`, hoặc `/usr/local/bin/pi-web` đối với các bản cài đặt độc lập)
- tệp phiên bản (`~/.pi/agent/pi-web-version`)
- tệp trạng thái runtime (`~/.pi/agent/pi-web/pi-web-state.json`)
- cấu hình tự khởi động (plist launchd trên macOS, dịch vụ người dùng systemd trên Linux, mục Run-key + script khởi chạy trên Windows)

Dữ liệu của bạn được giữ lại để lần cài đặt lại sau này có thể tiếp tục từ chỗ bạn
đã dừng: `~/.pi/agent/pi-web.sqlite`, `~/.pi/agent/pi-web-memory.sqlite`, các tệp
phiên của bạn trong `~/.pi/agent/sessions/` và `~/.config/pi-web/env` (bao gồm
`PI_WEB_TOKEN`). Hãy xóa thủ công những thứ đó nếu bạn muốn bắt đầu lại từ đầu.

## Sử dụng

```bash
# Start on the default port (31415)
pi-web

# Start and open a browser
pi-web -o

# Custom port
pi-web -p 8080

# Override bind host (loopback is unauthenticated by default)
pi-web --host 127.0.0.1

# Non-loopback bind requires a token — pi-web refuses to start otherwise
PI_WEB_TOKEN=$(openssl rand -hex 16) pi-web --host 192.168.1.50
```

Theo mặc định, pi-web ràng buộc vào `127.0.0.1`. Nếu Tailscale đang chạy với MagicDNS **và `PI_WEB_TOKEN` được đặt**, pi-web cũng chạy `tailscale serve --bg --https=<port> http://127.0.0.1:<port>` và in ra URL HTTPS tailnet. Nếu không có token, pi-web chỉ ở chế độ loopback và bỏ qua Tailscale Serve, do đó các thiết bị ngang hàng trên tailnet không thể truy cập agent khi chưa xác thực. Bất kỳ ràng buộc không phải loopback nào được chỉ định rõ ràng cũng yêu cầu phải đặt `PI_WEB_TOKEN`; hãy truyền `--insecure` để ghi đè cho mục đích kiểm thử cục bộ.

## Truy cập từ xa

Hãy để pi-web lắng nghe cục bộ, rồi dùng URL HTTPS Tailscale được in ra từ điện thoại hoặc máy tính xách tay của bạn trên tailnet.

Trên macOS, hãy cài đặt và mở Tailscale một cách tương tác, phê duyệt lời nhắc quản trị viên và đăng nhập. Sau đó chạy `/pi-web restart`, tiếp theo là `/remote`.

Trên Linux, hãy cho phép người dùng của bạn quản lý Tailscale trước khi cài đặt/chạy pi-web, nếu không `tailscale serve` có thể yêu cầu sudo và việc tự khởi động có thể thất bại:

```bash
sudo tailscale set --operator=$USER
```

```bash
# 1. Start pi-web with a token so it publishes the Tailscale HTTPS endpoint
PI_WEB_TOKEN=$(openssl rand -hex 16) pi-web

# 2. From any other Tailscale-connected device, open the printed
#    "Tailscale HTTPS" URL and enter the token once.
```

> Theo mặc định, pi-web từ chối ràng buộc vào địa chỉ không phải loopback trừ khi `PI_WEB_TOKEN` được đặt — nếu không, bất kỳ ai có thể truy cập địa chỉ được ràng buộc đều có thể xem các phiên và gửi chỉ thị cho pi. Để ghi đè lớp bảo vệ này cho việc kiểm thử trên mạng cục bộ, hãy truyền `--insecure`. **Đừng dùng `--insecure` trên Tailscale hoặc bất kỳ địa chỉ nào có thể truy cập từ bên ngoài máy của bạn.**
>
> Máy khách có thể truyền token qua header `Authorization: Bearer <token>`, header `X-Pi-Token`, hoặc một lần qua `?token=<token>` (hoặc lời nhắc đăng nhập). Khi token đến qua chuỗi truy vấn, pi-web đặt một cookie `pi_token` và chuyển hướng đến cùng URL với token đã bị loại bỏ, nhờ đó token không đọng lại trên thanh địa chỉ hoặc lịch sử trình duyệt. Ưu tiên dùng dạng header cho script và tự động hóa.

## Trò chuyện trên trình duyệt

Mở một trang phiên và dùng khung soạn thảo ở dưới cùng để tiếp tục đúng phiên đó.

- `Enter` để gửi, `Shift+Enter` để chèn dòng mới
- Kéo-thả hoặc dán hình ảnh trực tiếp vào khung soạn thảo
- Bộ chọn model và bộ chọn mức suy nghĩ nằm ở phần đầu trang — các thay đổi áp dụng ngay lập tức cho worker pi bên dưới
- Mỗi phiên đang hoạt động có worker `pi --mode rpc` riêng, vì vậy các phiên khác nhau không chặn lẫn nhau

## Chia sẻ phiên

Nhấp **Share** trên trang phiên để tạo một GitHub Gist bí mật.

Yêu cầu:

- đã cài đặt `gh`
- đã hoàn tất `gh auth login`

Chia sẻ trả về:

- URL gist bí mật
- một URL xem trước tại `https://pi.dev/session/#<gistId>`

Các gist được chia sẻ là ảnh chụp tĩnh và không cập nhật trực tiếp.

## Tự khởi động khi đăng nhập

### macOS

```bash
cp init/com.pi-web.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.pi-web.plist
```

### Linux (systemd)

```bash
# Install the systemd user service
mkdir -p ~/.config/systemd/user
cp init/pi-web.service ~/.config/systemd/user/

# Optional: set your PI_WEB_TOKEN for non-loopback binds
# (or use /pi-web set-token <token> from inside pi)
mkdir -p ~/.config/pi-web
echo 'PI_WEB_TOKEN=your-token-here' > ~/.config/pi-web/env

# Enable and start
systemctl --user daemon-reload
systemctl --user enable --now pi-web.service

# Check status
systemctl --user status pi-web.service

# View logs
journalctl --user -u pi-web.service -f
```

> Để dịch vụ khởi động khi máy khởi động (trước khi đăng nhập), hãy dùng dịch vụ hệ thống thay thế:
> sao chép `init/pi-web.service` vào `/etc/systemd/system/` và dùng `sudo systemctl`.

### Windows

Trình cài đặt cấu hình việc này tự động, không cần quyền quản trị: một mục
`pi-web` trong `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` khởi chạy
`~/.config/pi-web/pi-web-start.vbs` khi đăng nhập, mục này khởi động tệp nhị
phân ở chế độ ẩn (không có cửa sổ console) sau khi nạp `~/.config/pi-web/env`
(`PI_WEB_TOKEN`, `PATH`, ...).

Để quản lý thủ công:

```powershell
# Start / stop
wscript.exe "$HOME\.config\pi-web\pi-web-start.vbs"
taskkill /IM pi-web.exe /F

# Remove auto-start
Remove-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'pi-web'
```

Không có giám sát dịch vụ trên Windows: nếu pi-web gặp sự cố, nó vẫn dừng cho
đến lần đăng nhập tiếp theo (launchd/systemd tự khởi động lại nó trên các nền
tảng khác).
