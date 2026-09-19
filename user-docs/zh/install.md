# 安装与使用

## 功能特性

### 远程控制

- 在浏览器中通过文本或图片附件继续任意会话
- 直接通过 Web 界面针对任意项目路径启动全新会话
- 浏览器内的模型切换与思考级别选择器，按会话生效
- 每个会话的 worker 状态（空闲 / 运行中 / 错误），崩溃时自动恢复
- 多个会话并行运行——在一个会话中启动工作，同时观看另一个会话的流式输出
- `PI_WEB_TOKEN` 用于安全地暴露到局域网——默认情况下任何显式的非回环绑定都必须提供

### 阅读会话

- 通过筛选、搜索和完整的分支导航，跨项目浏览会话
- 在 pi 仍在运行时实时增量更新（通过 fsnotify；约毫秒级延迟）
- 跟随模式，用于追踪正在进行的会话
- 指向单条消息的深链接
- 以 JSONL 格式下载会话
- 将静态快照分享为私密 GitHub Gist
- `/web`、`/remote`、`/refresh`、`/pi-web token` 和 `/pi-web set-token` pi 扩展，用于打开会话、远程 QR、会话同步和令牌管理
- `/skill:pi-web-schedule`、`/skill:pi-web-notes`、`/skill:pi-web-settings`（`pi-web-ctl`），让会话能够用自然语言管理日程、项目便签和设置

## 环境要求

- [Go](https://go.dev) 1.25+（仅从源码构建时需要）
- `PATH` 中有 `pi`，用于浏览器聊天 / 模型切换
- 可选：`gh`，用于分享
- 在 Windows 上：pi 的 shell 工具需要 bash shell——[Git for Windows](https://git-scm.com/download/win) 即可（参见 pi 的 Windows 文档）

## 安装

### Pi 包（推荐）

```bash
pi install npm:@ygncode/pi-web@beta
```

这一条命令会：

- 将 npm pi 包安装到 pi 的包目录下
- 运行包的 `postinstall` 脚本（`install.sh`，Windows 上为 `install.ps1`）
- 从 GitHub Releases 下载与你的包版本和平台匹配的 pi-web 二进制文件
- 将其安装到 `~/.pi/agent/bin/pi-web`（Windows 上为 `pi-web.exe`）
- 设置登录时自动启动（macOS 上用 launchd，Linux 上用 systemd，Windows 上用 Run 键启动器）
- 注册 `/web`、`/remote`、`/refresh`、`/pi-web token` 和 `/pi-web set-token` pi 命令

会话自动命名功能内置于 pi-web（而非扩展中），可在 `/settings` 页面配置。它默认开启：pi-web 使用免费的内置单词启发式算法（不涉及 AI）自动为会话命名，并在每条新消息时重新命名。你可以切换为每个会话仅命名一次，和/或选择一个模型来生成更智能的标题，取代启发式算法。

在 Linux 上，自动启动被配置为位于 `~/.config/systemd/user/pi-web.service` 的用户级 systemd 服务。安装程序会将其 `ExecStart` 重写为实际安装的二进制路径。如果运行时 Tailscale 可用，pi-web 会通过 Tailscale Serve HTTPS 发布 localhost 服务器。如果用户级 systemd 不可用，请手动运行 `~/.pi/agent/bin/pi-web -o`。

要仅为特定项目安装（通过 `.pi/settings.json` 与团队共享）：

```bash
pi install -l npm:@ygncode/pi-web@beta
```

然后重启 pi（或运行 `/reload`），使用 `/web`、`/pi-web`、`/remote`、`/refresh`。通过 `/pi-web token` 和 `/pi-web set-token` 管理你的访问令牌。

如果 npm 在重命名 `@ygncode/pi-web` 时因 `ENOTEMPTY` 中止，请删除 npm 残留的隐藏备份目录并重新安装 beta 通道：

```bash
rm -rf ~/.pi/agent/npm/node_modules/@ygncode/.pi-web-*
pi install npm:@ygncode/pi-web@beta
```

### 快速安装（无需构建工具）

macOS / Linux：

```bash
curl -fsSL https://raw.githubusercontent.com/ygncode/pi-web/main/install.sh | bash
```

Windows（PowerShell）：

```powershell
irm https://raw.githubusercontent.com/ygncode/pi-web/main/install.ps1 | iex
```

这会下载最新的 pi-web 二进制文件，将其安装到 `/usr/local/bin`（Windows 上为 `~/.pi/agent/bin`），并设置登录时自动启动。无需 Go、Node 或 pi。

### 下载二进制文件

每个 [GitHub Release](https://github.com/ygncode/pi-web/releases) 都附带预编译的二进制文件。

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

然后将其移动到你的 PATH 中：

```bash
cp pi-web ~/.pi/agent/bin/
# 或安装到系统范围：
sudo cp pi-web /usr/local/bin/
```

### 从源码构建

```bash
git clone https://github.com/ygncode/pi-web.git
cd pi-web
make build   # 构建 Vite 包，然后将其嵌入 Go 二进制文件

# 可选：将其放入 PATH
cp pi-web ~/.pi/agent/bin/
```

前端包由 `web/assets_embed.go` 嵌入，因此 `go build` 需要先存在 `web/dist`。`make build` 会按顺序完成这两个步骤；如果你手动构建，请先运行 `npm --prefix web install && npm --prefix web run build`，再运行 `go build ./cmd/pi-web`。

### 与已安装实例并行开发

让已安装实例在端口 `31415` 上保持运行，然后以开发模式启动源码检出：

```bash
make dev
```

打开 `http://127.0.0.1:31416`。`make dev` 会设置内部的 `PI_WEB_DEV=1` 开发环境，因此源码检出会与已安装实例共享会话、设置和 SQLite 数据，同时保留独立的开发运行时锁和状态文件。常规的已安装实例和手动启动的实例保持不变，并保留原有的单实例行为。

为防止重复的自主工作，开发模式不会运行日程循环、聊天队列处理器、自动命名或推送通知。通过开发 UI 发出的直接请求仍然有效。请勿同时从两个实例驱动同一个聊天会话；每个进程都有自己的 RPC worker 管理器。

`make dev` 需要 [Air](https://github.com/air-verse/air) 来实现 Go 热重载：

```bash
go install github.com/air-verse/air@latest
```

`PI_WEB_DEV` 是开发脚手架的一部分，并非受支持的生产环境多实例模式。

## 卸载

```bash
pi remove npm:@ygncode/pi-web@beta
```

这会运行包的 `preuninstall` 脚本（`uninstall.sh`，Windows 上为 `uninstall.ps1`），它会停止正在运行的实例并移除：

- pi-web 二进制文件（`~/.pi/agent/bin/pi-web`，独立安装时为 `/usr/local/bin/pi-web`）
- 版本文件（`~/.pi/agent/pi-web-version`）
- 运行时状态文件（`~/.pi/agent/pi-web/pi-web-state.json`）
- 自动启动配置（macOS 上的 launchd plist，Linux 上的 systemd 用户服务，Windows 上的 Run 键条目 + 启动脚本）

你的数据会被保留，因此之后重新安装可以从中断处继续：`~/.pi/agent/pi-web.sqlite`、`~/.pi/agent/pi-web-memory.sqlite`、`~/.pi/agent/sessions/` 下的会话文件，以及 `~/.config/pi-web/env`（包括 `PI_WEB_TOKEN`）。如果你想彻底清空，请手动删除这些文件。

## 使用

```bash
# 在默认端口（31415）启动
pi-web

# 启动并打开浏览器
pi-web -o

# 自定义端口
pi-web -p 8080

# 覆盖绑定主机（回环地址默认无需认证）
pi-web --host 127.0.0.1

# 非回环绑定需要令牌——否则 pi-web 拒绝启动
PI_WEB_TOKEN=$(openssl rand -hex 16) pi-web --host 192.168.1.50
```

默认情况下，pi-web 绑定到 `127.0.0.1`。如果 Tailscale 正在运行且启用了 MagicDNS **并且设置了 `PI_WEB_TOKEN`**，pi-web 还会运行 `tailscale serve --bg --https=<port> http://127.0.0.1:<port>` 并打印 HTTPS tailnet URL。如果没有令牌，pi-web 仅保持回环监听并跳过 Tailscale Serve，因此 tailnet 对等方无法在未认证的情况下访问 agent。任何显式的非回环绑定也都要求设置 `PI_WEB_TOKEN`；如需在本地测试时覆盖，请传入 `--insecure`。

## 远程访问

让 pi-web 在本地监听，然后在 tailnet 上用你的手机或笔记本电脑访问打印出的 Tailscale HTTPS URL。

在 macOS 上，交互式地安装并打开 Tailscale，批准管理员提示并登录。然后运行 `/pi-web restart`，接着运行 `/remote`。

在 Linux 上，安装/运行 pi-web 之前，请允许你的用户管理 Tailscale，否则 `tailscale serve` 可能需要 sudo 且自动启动可能失败：

```bash
sudo tailscale set --operator=$USER
```

```bash
# 1. 使用令牌启动 pi-web，以便其发布 Tailscale HTTPS 端点
PI_WEB_TOKEN=$(openssl rand -hex 16) pi-web

# 2. 从任何其他已连接 Tailscale 的设备，打开打印出的
#    “Tailscale HTTPS” URL，并输入一次令牌。
```

> 默认情况下，除非设置了 `PI_WEB_TOKEN`，否则 pi-web 拒绝绑定到非回环地址——否则任何能访问该绑定地址的人都可能查看会话并向 pi 发送指令。要在本地网络测试时覆盖此防护，请传入 `--insecure`。**请勿在 Tailscale 或任何可从你机器外部访问的地址上使用 `--insecure`。**
>
> 客户端可以通过 `Authorization: Bearer <token>` 请求头、`X-Pi-Token` 请求头，或通过 `?token=<token>`（或登录提示）传递一次令牌。当令牌通过查询字符串到达时，pi-web 会设置一个 `pi_token` cookie 并重定向到去除令牌后的相同 URL，这样令牌就不会残留在地址栏或浏览器历史中。对于脚本和自动化，建议使用请求头形式。

## 浏览器聊天

打开会话页面，使用底部的输入框继续该会话。

- `Enter` 发送，`Shift+Enter` 插入换行
- 将图片直接拖放或粘贴到输入框中
- 模型选择器和思考级别选择器位于页眉——更改会立即应用到底层 pi worker
- 每个活动会话都有自己专属的 `pi --mode rpc` worker，因此不同会话之间不会相互阻塞

## 分享会话

在会话页面上点击 **Share** 即可创建一个私密 GitHub Gist。

要求：

- 已安装 `gh`
- 已完成 `gh auth login`

分享会返回：

- 私密 gist URL
- 位于 `https://pi.dev/session/#<gistId>` 的预览 URL

分享的 gist 是快照，不会实时更新。

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
# （或在 pi 中使用 /pi-web set-token <token>）
mkdir -p ~/.config/pi-web
echo 'PI_WEB_TOKEN=your-token-here' > ~/.config/pi-web/env

# 启用并启动
systemctl --user daemon-reload
systemctl --user enable --now pi-web.service

# 查看状态
systemctl --user status pi-web.service

# 查看日志
journalctl --user -u pi-web.service -f
```

> 要让服务在启动时（登录之前）运行，请改用系统级服务：将 `init/pi-web.service` 复制到 `/etc/systemd/system/` 并使用 `sudo systemctl`。

### Windows

安装程序会自动完成此配置，无需管理员权限：`HKCU\Software\Microsoft\Windows\CurrentVersion\Run` 下的 `pi-web` 条目会在登录时启动 `~/.config/pi-web/pi-web-start.vbs`，它会在加载 `~/.config/pi-web/env`（`PI_WEB_TOKEN`、`PATH` 等）后以隐藏方式（无控制台窗口）启动二进制文件。

手动管理：

```powershell
# 启动 / 停止
wscript.exe "$HOME\.config\pi-web\pi-web-start.vbs"
taskkill /IM pi-web.exe /F

# 移除自动启动
Remove-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'pi-web'
```

Windows 上没有服务监管：如果 pi-web 崩溃，它会一直处于停止状态，直到下次登录（在其他平台上，launchd/systemd 会自动重启它）。
