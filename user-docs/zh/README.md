# 欢迎使用 pi-web 🖥️

<div align="center">

[English](../en/README.md) · [Español](../es/README.md) · [Français](../fr/README.md) · [Deutsch](../de/README.md) · **中文** · [日本語](../ja/README.md) · [Bahasa Indonesia](../id/README.md) · [Bahasa Melayu](../ms/README.md) · [Tiếng Việt](../vi/README.md) · [ไทย](../th/README.md) · [Filipino](../fil/README.md) · [မြန်မာ](../my/README.md) · [ភាសាខ្មែរ](../km/README.md) · [ລາວ](../lo/README.md)

</div>

**正在考虑尝试 pi-web？放手一试吧——你会爱上它的。**

pi-web 是一个漂亮的 Web UI 和 PWA，服务于 [pi](https://pi.dev)——这个开源 AI 编程智能体。它让你可以在任何浏览器、任何设备上浏览、阅读并继续你的 pi 会话，处处都有贴心的功能。

**pi-web 为两类人而打造：**

- 🧑‍💻 **面向开发者**——他们生活在终端里，但想要从手机上继续会话、转交给远程服务器，或随时随地监控长时间运行的任务。
- ✨ **面向非开发者**——他们只想要一个好看又好用的 AI 应用。打开它，输入，享受。没有终端，没有 SSH，没有困惑。就像最友好的 AI 工具，但拥有模型选择和开源的自由。

---

## 为什么选择 pi-web？

你已经在终端里与 pi 深度协作。当你离开办公桌时，pi-web 让这份势头延续下去：

- **随时随地继续**——从你的手机、平板或另一台电脑继续会话。无需 SSH，无需 Termius——只需打开浏览器。
- **多会话仪表盘**——在一个会话中推进工作的同时，观看另一个会话的流式输出。跨项目搜索，按分支筛选，快速找到所需内容。
- **开源基础**——pi 完全开源且与提供商无关。你不会被锁定在单一模型或厂商上。pi-web 同样开源。
- **安全的远程访问**——内置令牌认证，让你可以放心地将其暴露在局域网或 Tailscale 上。
- **分享你的工作**——一键将会话导出为静态快照或私密的 GitHub Gist。

> 对背后的故事感兴趣？[阅读我们为什么构建它 →](why.md)

---

## 将 pi-web 作为你的个人 AI 工作空间 🏠

pi-web 是一个 PWA（渐进式 Web 应用），因此你可以**像原生应用一样安装它**到你的台式机、笔记本、手机或平板上——无需应用商店。在桌面上，它会在自己的窗口中打开，没有浏览器边框，看起来和用起来都像一个真正的桌面应用。

把它想象成**你自己的 Claude Cowork**——一个运行在你机器上的个人 AI 工作空间——只不过它是开源的，且与模型无关：

- **你拥有整个技术栈。** 选择任何模型，随时切换。运行本地模型，你的数据永远不会离开你的机器。
- **非技术人员也能使用。** 在他们的机器上设置好 pi-web，演示一次怎么用，他们就能上手了。你的父母、你的伴侣、你的非技术朋友——没有终端，没有 SSH，只有一个熟悉的聊天界面。
- **一次设置，多人使用。** 将它安装到你的台式机上并共享屏幕，或将其暴露在你的家庭网络上，让家人用自己的设备打开它。

想要的不只是编程？把它变成一个专属的[个人助理](personal-assistant.md)，它了解你是谁并住在你的机器上——就像你自己的 OpenClaw 或 Hermes。

> 💡 **专业提示：** 从 Chrome/Edge（点击地址栏中的安装图标）或 Safari（分享 → 添加到程序坞）将 pi-web 安装为 PWA。它会变得与原生应用毫无差别。

---

## 你可以用 pi-web 做什么

| | |
|---|---|
| 📱 **PWA** | 在台式机、手机或平板上将 pi-web 安装为渐进式 Web 应用，获得原生体验。 |
| 🔄 **继续会话** | 从上次中断的地方继续任何对话——文本、图片、模型切换，全部在浏览器中完成。 |
| 🆕 **开启新会话** | 直接通过 Web UI，针对任意项目路径创建全新会话。 |
| 📡 **实时流式输出** | 以约毫秒级延迟实时观看 pi 的响应流式输出。跟随模式让你始终锁定最新内容。 |
| 🌲 **树状视图** | 浏览 pi 原生的消息树——查看完整的对话结构，跳转到任意分支，并从任意节点分叉。 |
| 🔀 **分叉会话** | 从任意消息甚至某个特定的工具调用处分叉会话——探索不同方向而不丢失你的位置。 |
| 🔍 **浏览与搜索** | 跨项目筛选会话，按名称搜索，浏览分支——你的完整会话历史一目了然。 |
| 🌿 **Git 集成** | 在会话查看器中直接查看当前分支并打开 GitHub PR。 |
| 📝 **便签板** | 在会话旁随手记下笔记、待办事项或一闪而过的想法，无需切换应用。 |
| 💬 **批注** | 高亮并评论会话的任何部分——非常适合代码审查、反馈或标记关键时刻。 |
| 🎨 **主题与自定义** | 在深色和浅色模式之间切换，按你的喜好调整 UI——让 pi-web 感觉像*你自己的*。 |
| 🌐 **多语言** | 内置 14 种语言（English、Español、Français、Deutsch、中文、日本語、Bahasa Indonesia、Bahasa Melayu、Tiếng Việt、ไทย、Filipino、မြန်မာ、ភាសាខ្មែរ、ລາວ）。可在设置中添加你自己的自定义语言。 |
| 🐱 **健康与 pomodoro** | 过多的 vibe coding 不利于健康。内置 pomodoro 计时器，配有猫咪伙伴和睡眠提醒，助你保持平衡。 |
| 📤 **分享与导出** | 下载 JSONL，导出以 pi 原生 `pi.dev` 外观渲染的静态快照，或作为私密 GitHub Gist 分享——全部在客户端渲染。 |
| 🔔 **通知声音** | 可自定义的会话事件通知提示音——即使 pi-web 在另一个标签页中，也能保持消息同步。 |
| ⌨️ **键盘快捷键** | Vim 风格导航、快捷操作——[完整参考 →](keyboard-shortcuts.md) |
| 🤖 **个人助理** | 将 pi-web 变成住在你电脑上的专属 AI 助手——就像 OpenClaw 或 Hermes。[进行设置 →](personal-assistant.md) |
| 🗓️ **与日程对话** | 在 pi 会话中说“add a schedule at 2am Singapore time to …”——`/skill:pi-web-schedule`。 |
| 📝 **与笔记和设置对话** | “Write this in the notes”（`/skill:pi-web-notes`）或“switch to dark mode”（`/skill:pi-web-settings`）。 |

---

## 快速导航

| 如果你想了解…… | 阅读 |
|---|---|
| 如何安装、配置和使用 pi-web | [install.md](install.md) |
| 将 pi-web 用作个人助理 | [personal-assistant.md](personal-assistant.md) |
| 键盘快捷键参考 | [keyboard-shortcuts.md](keyboard-shortcuts.md) |
| pi-web 为何存在 | [why.md](why.md) |
| 接下来会有什么 | [roadmap.md](roadmap.md) |
| 安装遇到问题？让你的 LLM 来修复——把 llm-debug.md 链接粘贴给它 | [llm-debug.md](llm-debug.md) |

---

## 截图

| 桌面端 | 移动端 |
|---|---|
| ![桌面端](../assets/pi-web-desktop-screenshot.png) | ![移动端](../assets/pi-web-mobile-screenshot.png) |

---

## 💛 赞助

pi-web 是用热爱和无数个深夜打造出来的。我自掏腰包支付编程套餐（Claude Code、OpenCode 等）的费用，让这个项目持续前进。如果 pi-web 对你有用，你的支持意义重大。

**帮助的方式：**

- 💰 **[在 GitHub 上赞助](https://github.com/sponsors/setkyar)**——帮助支付让这一切成为可能的工具费用
- ☕ **[请我喝杯咖啡](https://buymeacoffee.com/setkyar)**——每一份心意都有帮助
- ⭐ **给仓库点星**——不花一分钱，还能帮助更多人发现 pi-web
- 📢 **分享给朋友和家人**——如果你认识会喜欢 pi-web 的人，把它分享给他们

无法赞助？完全没关系——一颗星和一次分享都大有裨益。感谢你的到来。🙏

---

编码愉快！🚀
