# 路线图

pi-web 面向两类受众：

- **面向开发者** — 他们生活在终端里，但希望能在手机上继续会话、把会话交接给远程服务器，或随时随地关注长时间运行的任务。
- **面向非开发者** — 他们只想要一个美观又好用的 AI 应用。打开它，输入，享受。无需终端、无需 SSH、无需困惑。就像最友好的 AI 工具，但拥有模型选择和开源自由。

以下是即将推出的内容。

---

## 现在（已发布）

[功能列表](README.md#what-you-can-do-with-pi-web) 中列出的所有内容现已全部上线。

曾经出现在本路线图上、现已发布的功能：

| 功能 | 说明 |
|---|---|
| **操控 / 队列** ([#46](https://github.com/ygncode/pi-web/issues/46)) | 在 pi 仍在运行时发送后续指令，或将消息排队到下一轮。 |
| **调度器** ([#44](https://github.com/ygncode/pi-web/issues/44)) | 在 `/schedules` 页面安排提示词自动运行——每日站会、晨间摘要、周期性任务。 |
| **可配置的显示默认值** ([#48](https://github.com/ygncode/pi-web/issues/48)) | 为所有会话设置你偏好的思考、工具和工具输出的可见性。 |
| **Git diff**（[#47](https://github.com/ygncode/pi-web/issues/47) 的一部分） | 在会话 diff 弹窗中查看未提交的工作区更改，并附带审查评论。 |

---

## 接下来

| # | 功能 | 说明 |
|---|---|---|
| [#50](https://github.com/ygncode/pi-web/issues/50) | **Telegram 与 Discord 机器人** | 通过 Telegram 或 Discord 与 pi 聊天——非常适合移动场景下的个人助理工作流。 |
| [#49](https://github.com/ygncode/pi-web/issues/49) | **用量洞察** | 跨会话的 token 追踪、成本估算和分析——超越会话菜单中按会话的细分。 |
| [#41](https://github.com/ygncode/pi-web/issues/41) | **`/compact` 命令** | 直接在 Web UI 中压缩长对话，无需终端。 |

---

## 计划中

| # | 功能 | 说明 |
|---|---|---|
| [#47](https://github.com/ygncode/pi-web/issues/47) | **文件浏览器** | 直接在 pi-web 中浏览项目文件树。需主动开启，因此不会打扰你。 |
| [#43](https://github.com/ygncode/pi-web/issues/43) | **可自定义快捷键** | 重新映射每个键盘快捷键，以匹配你的肌肉记忆。 |

---

## 愿景

长期目标：pi-web 应成为 **pi 的界面**——面向所有人。

- **非开发者**像打开其他应用一样打开它。选择模型。输入。完成。永远不需要命令行。
- **开发者**获得深度集成——远程交接、多会话仪表盘、感知 Git 的浏览、消息机器人。
- **每个人**都能享受模型自由、开源透明，以及在每个环节都体贴入微的界面。

---

> 💡 有想法吗？[提交 issue](https://github.com/ygncode/pi-web/issues/new) 或加入讨论。
