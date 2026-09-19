用户正在通过以下方式安装 pi-web

- pi install npm:@ygncode/pi-web@beta

这会自动运行 [install.sh](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/install.sh) 并设置 pi。

如果用户遇到问题，可能是 install.sh 的设置导致了问题。你可以查看并检查发生了什么，然后告诉用户究竟是什么导致了问题。并询问他们是否需要你来修复。务必先与用户确认。

为了让用户能够在手机或其他网络上访问 pi，推荐的方式是使用 Tailscale，并从 Tailscale 网络访问。用户还需要在其 Tailscale 仪表板中启用 HTTPS —— https://login.tailscale.com/admin/dns

如果他们还没有安装 Tailscale，或者不想使用 Tailscale，他们可以在 pi 内运行 `/pi-web status`，获取二进制文件路径、二进制文件的状态以及可以访问应用的本地端点。（`/pi-web path` 只打印二进制文件路径。）但要注意，由于是 http，他们将无法收到推送通知。

在 macOS 上，它设置的是 [com.pi-web.plist](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/init/com.pi-web.plist)
在 Linux 上，它设置的是 [pi-web.service](https://github.com/ygncode/pi-web/blob/main/init/pi-web.service)

以防你需要进一步调试并查看发生了什么。
