<h1 align="center">pi-web (Remote Control Your Pi)</h1>

<div align="center">

[![GitHub stars](https://img.shields.io/github/stars/ygncode/pi-web?style=flat&logo=github&label=stars&cacheSeconds=86400)](https://github.com/ygncode/pi-web/stargazers)
[![npm downloads](https://img.shields.io/npm/dw/@ygncode/pi-web?label=downloads/wk&color=2ea043&cacheSeconds=86400)](https://www.npmjs.com/package/@ygncode/pi-web)
[![license MIT](https://img.shields.io/npm/l/@ygncode/pi-web?label=license&color=0a7bbb&cacheSeconds=86400)](../../LICENSE)
[![Telegram](https://img.shields.io/badge/Telegram-Join-26A5E4?logo=telegram&logoColor=white)](https://t.me/+NJvFOTTa0wNjNTc9)
![platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-555)

[English](../../README.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [Bahasa Indonesia](README.id.md) · [Bahasa Melayu](README.ms.md) · **Tiếng Việt** · [ไทย](README.th.md) · [Filipino](README.fil.md) · [မြန်မာ](README.my.md) · [ភាសាខ្មែរ](README.km.md) · [ລາວ](README.lo.md)

</div>

<div align="center">

Điều khiển [pi](https://pi.dev) coding agent của bạn từ điện thoại, máy tính bảng hoặc máy tính xách tay — bất kỳ đâu trên mạng của bạn, hoặc từ xa qua Tailscale.

Đây là một PWA hoàn chỉnh, vì vậy bạn có thể cài đặt và sử dụng nó như một ứng dụng gốc trên mọi thiết bị. Hãy coi nó như không gian làm việc AI cá nhân của riêng bạn — giống như Cowork của Claude, nhưng với nhiều mô hình khác nhau — trò chuyện qua nhiều mô hình, lập trình từ điện thoại, hoặc biến nó thành [trợ lý cá nhân](user-docs/en/personal-assistant.md) sống trên máy của bạn.

Hãy biến nó thành của bạn: chuyển đổi chủ đề và phông chữ, và sử dụng nó bằng ngôn ngữ của bạn — pi-web đi kèm với nhiều ngôn ngữ và bạn có thể thêm ngôn ngữ của riêng mình. Nhiều tính năng hơn đang được phát triển, nhưng nó sẽ không trở nên cồng kềnh: mọi thứ bạn không cần đều có thể tắt trong cài đặt.

</div>

> [!WARNING]
> pi-web hiện đang trong giai đoạn **beta**. Mọi thứ sẽ thay đổi và có thể bị hỏng!

> [!TIP]
> Mới ở đây? **[Đọc hướng dẫn sử dụng →](user-docs/en/README.md)** để có cái nhìn toàn diện về tính năng, các bước cài đặt và mẹo. ([Ngôn ngữ khác →](../README.md))

## Ảnh chụp màn hình

<div align="center">
  <img src="../assets/pi-web-desktop-screenshot.png" alt="Desktop" width="90%" /><br />
  <em>Máy tính để bàn</em>
  <br /><br />
  <img src="../assets/pi-web-mobile-screenshot.png" alt="Mobile PWA" width="90%" /><br />
  <em>PWA trên di động</em>
</div>

## Cách Nó Hoạt Động Cùng Nhau

```
 pi (terminal)                 Browser (phone / tablet / laptop)
      │                                │
      │  writes JSONL                  │  HTTP + SSE
      ▼                                ▼
 ~/.pi/agent/sessions/  ←───  pi-web (Go HTTP server)
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
              pi --mode rpc      fsnotify         tailscale serve
            (per‑session       (live reload)      (remote HTTPS
             chat worker)                           via MagicDNS)
```

- **pi** ghi JSONL hội thoại vào `~/.pi/agent/sessions/` khi nó hoạt động.
- **pi-web** là một máy chủ Go đọc các tệp đó, hiển thị chúng trong trình duyệt và truyền phát cập nhật trực tiếp qua SSE.
- Các worker **pi --mode rpc** xử lý trò chuyện do trình duyệt khởi tạo — một worker mỗi phiên, bị thu hồi sau 10 phút không hoạt động.
- **fsnotify** theo dõi thư mục phiên để trình duyệt tải lại trong vòng mili-giây khi có đầu ra mới.
- **Tailscale Serve** công bố máy chủ localhost dưới dạng điểm cuối HTTPS trên tailnet của bạn.

## Cài đặt

```bash
pi install npm:@ygncode/pi-web@beta
```

Chỉ vậy thôi — nó tải xuống tệp nhị phân phù hợp, thiết lập tự động khởi động và đăng ký các lệnh `/web`, `/pi-web`, `/remote` và `/refresh`.

Sau khi cài đặt, mở `http://127.0.0.1:31415` trong trình duyệt của bạn. Từ pi, sử dụng `/web` để mở phiên hiện tại trong trình duyệt của bạn ngay lập tức. Nếu Tailscale đang chạy trên máy của bạn, pi-web tự động công bố một điểm cuối HTTPS trên tailnet của bạn — sử dụng `/remote` từ pi để nhận mã QR và URL cho mọi thiết bị trên tailnet của bạn.

> **Truy cập từ xa trên macOS:** Cài đặt và mở Tailscale theo cách tương tác, chấp thuận lời nhắc của quản trị viên rồi đăng nhập. Sau đó chạy `/pi-web restart`, tiếp theo là `/remote`.

Để cài đặt thủ công, tải xuống tệp nhị phân hoặc xây dựng từ mã nguồn, xem [user-docs/install.md](user-docs/en/install.md).

## Tích hợp Pi

Sau khi `pi install npm:@ygncode/pi-web@beta`, bạn nhận được:

| Lệnh | Chức năng |
|---------|--------------|
| `/web` | Mở phiên hiện tại trong trình duyệt của bạn (nhận biết SSH: bỏ qua trình duyệt và chỉ hiển thị URL) |
| `/pi-web` | Hiển thị trạng thái, phiên bản, khởi động/dừng/khởi động lại máy chủ hoặc cập nhật |
| `/remote` | Hiển thị mã QR và URL để truy cập từ xa qua Tailscale |
| `/refresh` | Kéo tin nhắn mới được viết từ trình duyệt từ xa trở lại phiên terminal |

Tự động đặt tiêu đề phiên được tích hợp sẵn trong chính pi-web và được cấu hình trên trang `/settings`. Nó được **bật theo mặc định** và tự động đặt tên cho các phiên. Bạn có thể chọn:

- **Khi nào đặt tiêu đề** — một lần mỗi phiên, hoặc trên mỗi tin nhắn mới (mặc định).
- **Mô hình đặt tiêu đề** — một **heuristic từ tích hợp sẵn miễn phí, tức thì (không dùng AI)** theo mặc định, hoặc chọn một mô hình (ví dụ: mô hình nhỏ/nhanh) để có tiêu đề thông minh hơn do mô hình viết.

Gói cũng cài đặt tệp nhị phân pi-web vào `~/.pi/agent/bin/pi-web` và thiết lập tự động khởi động khi đăng nhập.

## Tự động khởi động khi đăng nhập

Lệnh `pi install npm:@ygncode/pi-web@beta` tự động thiết lập điều này:

| HĐH | Cơ chế |
|----|-----------|
| macOS | launchd plist tại `~/Library/LaunchAgents/com.pi-web.plist` |
| Linux | systemd user service tại `~/.config/systemd/user/pi-web.service` |

Để đặt token cho truy cập từ xa, tạo tệp `~/.config/pi-web/env`:

```
PI_WEB_TOKEN=your-token-here
```

Để biết thêm chi tiết (thiết lập thủ công, cổng tùy chỉnh, liên kết không loopback), xem [user-docs/install.md](user-docs/en/install.md).

## Phát triển

```bash
make setup   # install frontend deps and download Go modules
make check   # frontend test/build + Go test/vet
make build   # setup if needed, build frontend, then build ./pi-web
```
