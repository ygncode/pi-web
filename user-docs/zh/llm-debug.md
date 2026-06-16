用户正在通过以下方式安装 pi-web：

- pi install npm:@ygncode/pi-web@beta

该命令会自动运行 [install.sh](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/install.sh) 并设置 pi。

如果用户遇到问题，可能是 install.sh 的设置导致的。你可以检查并了解具体情况，然后告知用户问题所在。询问他们是否需要你修复。务必先与用户确认。

为了让用户能够在手机或其他网络中访问 pi，推荐使用 Tailscale 并通过 Tailscale 网络进行访问。用户还需要在其 Tailscale 后台启用 HTTPS：https://login.tailscale.com/admin/dns

如果没有安装 Tailscale 或不想使用 Tailscale，可以运行 `pi-web status` 获取二进制文件路径、二进制文件状态以及可访问该应用的本地端点。但请注意，由于使用 http，将无法收到推送通知。

在 macOS 上，会设置 [com.pi-web.plist](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/init/com.pi-web.plist)
在 Linux 上，会设置 [pi-web.service](https://github.com/ygncode/pi-web/blob/main/init/pi-web.service)

如需进一步调试并了解情况。
