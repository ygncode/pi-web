# 安装与使用

## 功能特性

### 远程控制

- 在浏览器中继续任意会话，支持文本或图片附件
- 直接从 Web 界面针对任意项目路径启动全新会话
- 浏览器内的模型切换和思考级别选择器，按会话独立设置
- 每个会话显示 worker 状态（idle / running / error），崩溃时自动恢复
- 多个会话并行运行 — 一个会话中启动任务，同时在另一个中观看流式输出
- `PI_WEB_TOKEN` 用于安全的局域网暴露 — 默认情况下，任何显式的非回环绑定都需要此令牌

### 阅读会话

- 跨项目浏览会话，支持筛选、搜索和完整的分支导航
- pi 仍在运行时实时增量更新（通过 fsnotify；延迟约毫秒级）
- 跟随模式，用于追踪活跃会话
- 可深链接到单条消息
- 将会话下载为 JSONL
- 将静态快照分享为私密 GitHub Gist
- `/web`、`/remote`、`/refresh`、`/pi-web token` 和 `/pi-web set-token` pi 扩展，用于打开会话、远程二维码、会话同步和令牌管理

## 系统要求

- [Go](https://go.dev) 1.25+
- `pi` 需在 `PATH` 中，用于浏览器聊天/模型切换
- 可选：`gh` 用于分享

## 安装

### Pi 包（推荐）

```bash
pi install npm:@ygncode/pi-web@beta
```

仅一条命令即可完成：
- 在 pi 的包目录下安装 npm pi 包
- 运行包的 `postinstall` 脚本（`bash install.sh`）
- 从 GitHub Releases 下载与您的包版本和平台匹配的 pi-web 二进制文件
- 安装到 `~/.pi/agent/bin/pi-web`
- 设置登录时自动启动（macOS 上使用 launchd，Linux 上使用 systemd）
- 注册 `/web`、`/remote`、`/refresh`、`/pi-web token` 和 `/pi-web set-token` pi 命令

会话自动标题功能内置于 pi-web（而非扩展），可在 `/settings` 页面进行配置。默认开启：pi-web 使用免费的內建单词启发式算法（无需 AI）自动为会话命名，每收到一条新消息即重新生成标题。您可以切换为每个会话仅命名一次，和/或选择一个模型来生成更智能的标题以替代启发式算法。

在 Linux 上，自动启动配置为用户 systemd 服务，位于 `~/.config/systemd/user/pi-web.service`。安装程序会将其 `ExecStart` 重写为实际安装的二进制文件路径。如果运行时 Tailscale 可用，pi-web 会使用 Tailscale Serve HTTPS 发布 localhost 服务器。如果用户 systemd 不可用，请手动运行 `~/.pi/agent/bin/pi-web -o`。

仅为特定项目安装（通过 `.pi/settings.json` 与团队共享）：

```bash
pi install -l npm:@ygncode/pi-web@beta
```

然后重启 pi（或运行 `/reload`），使用 `/web`、`/pi-web`、`/remote`、`/refresh`。通过 `/pi-web token` 和 `/pi-web set-token` 管理您的访问令牌。

如果 npm 在重命名 `@ygncode/pi-web` 时因 `ENOTEMPTY` 中止，请移除 npm 残留的隐藏备份目录并重新安装 beta 频道：

```bash
rm -rf ~/.pi/agent/npm/node_modules/@ygncode/.pi-web-*
pi install npm:@ygncode/pi-web@beta
```

### 快速安装（无需构建工具）

```bash
curl -fsSL https://raw.githubusercontent.com/ygncode/pi-web/main/install.sh | bash
```

此命令会下载最新的 pi-web 二进制文件，安装到 `/usr/local/bin`，并设置登录时自动启动。无需 Go、Node 或 pi。

### 下载二进制文件

预构建的二进制文件附在每个 [GitHub Release](https://github.com/ygncode/pi-web/releases) 中。

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

然后将其移动到您的 PATH 中：

```bash
cp pi-web ~/.pi/agent/bin/
# 或系统全局安装：
sudo cp pi-web /usr/local/bin/
```

### 从源码构建

```bash
git clone https://github.com/ygncode/pi-web.git
cd pi-web
make build   # 构建 Vite 打包产物，然后嵌入 Go 二进制文件

# 可选：放入 PATH
cp pi-web ~/.pi/agent/bin/
```

前端打包文件由 `web/assets_embed.go` 嵌入，因此 `go build` 需要 `web/dist` 预先存在。`make build` 会按顺序执行两个步骤；如果您手动构建，请在 `go build ./cmd/pi-web` 之前运行 `npm --prefix web install && npm --prefix web run build`。

## 卸载

```bash
pi remove npm:@ygncode/pi-web@beta
```

此命令运行包的 `preuninstall` 脚本（`bash uninstall.sh`），该脚本会停止正在运行的实例并移除：

- pi-web 二进制文件（`~/.pi/agent/bin/pi-web`，或独立安装的 `/usr/local/bin/pi-web`）
- 版本文件（`~/.pi/agent/pi-web-version`）
- 运行时状态文件（`~/.pi/agent/pi-web/pi-web-state.json`）
- 自动启动配置（macOS 上的 launchd plist，Linux 上的 systemd 用户服务）

您的数据将得到保留，以便日后重新安装时可以从中断处继续：
`~/.pi/agent/pi-web.sqlite`、`~/.pi/agent/pi-web-memory.sqlite`、`~/.pi/agent/sessions/` 下的会话文件以及 `~/.config/pi-web/env`（包括 `PI_WEB_TOKEN`）。如果您想完全重新开始，请手动删除这些内容。

## 使用

```bash
# 在默认端口（31415）上启动
pi-web

# 启动并打开浏览器
pi-web -o

# 自定义端口
pi-web -p 8080

# 覆盖绑定主机（回环地址默认无需认证）
pi-web --host 127.0.0.1

# 非回环绑定需要令牌 — 否则 pi-web 拒绝启动
PI_WEB_TOKEN=$(openssl rand -hex 16) pi-web --host 192.168.1.50
```

默认情况下，pi-web 绑定到 `127.0.0.1`。如果 Tailscale 正在运行并启用了 MagicDNS，pi-web 还会运行 `tailscale serve --bg --https=<port> http://127.0.0.1:<port>` 并打印 HTTPS tailnet URL。任何显式的非回环绑定都需要设置 `PI_WEB_TOKEN`；传递 `--insecure` 可在本地测试时绕过此限制。

## 远程访问

让 pi-web 在本地监听，然后在 tailnet 上使用手机或笔记本电脑访问打印出的 Tailscale HTTPS URL。

在 Linux 上，安装/运行 pi-web 之前，请允许您的用户管理 Tailscale，否则 `tailscale serve` 可能需要 sudo 且自动启动可能会失败：

```bash
sudo tailscale set --operator=$USER
```

```bash
# 1. 启动 pi-web
pi-web

# 2. 从任何其他连接了 Tailscale 的设备上，打开打印出的
#    "Tailscale HTTPS" URL。
```

> 默认情况下，除非设置了 `PI_WEB_TOKEN`，否则 pi-web 拒绝绑定到非回环地址 — 任何能够访问该绑定地址的人都可以查看会话并向 pi 发送指令。要在本地网络测试时覆盖此安全防护，请传递 `--insecure`。**不要在 Tailscale 或任何可从本机外部访问的地址上使用 `--insecure`。**
>
> 客户端可以通过 `Authorization: Bearer <token>` 标头、`X-Pi-Token` 标头传递令牌，或通过 `?token=<token>` 一次性传递（这会为后续请求设置 `pi_token` cookie）。通过 `?token=` 传递的令牌会出现在浏览器历史记录、服务器访问日志以及页面中任何链接的 `Referer` 标头中 — 因此除初始书签外，建议优先使用标头形式。

## 浏览器聊天

打开会话页面，使用底部的编写器继续该会话。

- `Enter` 发送，`Shift+Enter` 插入换行
- 将图片拖放或粘贴到编写器中
- 模型选择器和思考级别选择器位于页眉中 — 更改立即应用于底层的 pi worker
- 每个活跃会话拥有自己专属的 `pi --mode rpc` worker，因此不同会话不会互相阻塞

## 分享会话

在会话页面上点击 **Share** 即可创建一个私密 GitHub Gist。

要求：
- 已安装 `gh`
- 已完成 `gh auth login`

分享将返回：
- 私密 gist URL
- 位于 `https://pi.dev/session/#<gistId>` 的预览 URL

分享的 gist 是静态快照，不会实时更新。

## 登录时自动启动

### macOS

```bash
cp init/com.pi-web.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.pi-web.plist
```

### Linux（systemd）

```bash
# 安装 systemd 用户服务
mkdir -p ~/.config/systemd/user
cp init/pi-web.service ~/.config/systemd/user/

# 可选：为非回环绑定设置 PI_WEB_TOKEN
# （或在 pi 内部使用 /pi-web set-token <token>）
mkdir -p ~/.config/pi-web
echo 'PI_WEB_TOKEN=your-token-here' > ~/.config/pi-web/env

# 启用并启动
systemctl --user daemon-reload
systemctl --user enable --now pi-web.service

# 检查状态
systemctl --user status pi-web.service

# 查看日志
journalctl --user -u pi-web.service -f
```

> 要让服务在开机时启动（登录之前），请改用系统服务：
> 将 `init/pi-web.service` 复制到 `/etc/systemd/system/` 并使用 `sudo systemctl`。
