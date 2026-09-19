# pi-web 作为你的个人助理

pi-web 不仅仅用于编程——你可以把它变成住在你电脑上的**个人 AI 助理**，就像拥有自己的 OpenClaw 或 Hermes 一样。

## 工作原理

你在自己的机器上创建一个专用文件夹——那就是你的助理的家。在里面放一个 `APPEND_SYSTEM.md` 文件，用来定义你的助理是谁、它知道什么、以及它如何行事。pi-web 会给你一个漂亮的聊天界面，让你在任何设备上都能与它对话。

## 逐步操作

### 1. 创建你的助理文件夹

在你的电脑上选一个文件夹。例如：

```
~/my-assistant/
```

### 2. 定义你的助理

在该文件夹内创建一个 `APPEND_SYSTEM.md` 文件。这就是你告诉 pi 你的助理是谁的地方：

```markdown
# My Personal Assistant

You are Jarvis, my personal AI assistant. You help me with:

- Daily planning and reminders
- Research and summarization
- Drafting emails and messages
- Brainstorming ideas
- Keeping track of things I mention

## About me

- I'm a software engineer who works remotely
- I have a cat named Pixel
- I prefer short, direct answers
- My timezone is PST

## Rules

- Be concise — I value brevity
- If you don't know something, say so
- Proactively remind me of things I asked you to track
```

pi 会自动把它追加到每个对话的系统提示中，因此你的助理始终知道你是什么样的人以及该如何帮助你。

### 3. 在该文件夹中启动一个会话

在 pi-web 中，新建一个指向 `~/my-assistant/`（或你起的任何名字）的会话。就这么简单——你已经在和你的个人助理对话了。

### 4. 随时随地使用它

在手机、平板或笔记本电脑上把 pi-web 安装为 PWA。你的助理始终在线——随时随地向它提问任何问题。

## 给你的助理的点子

| 角色 | 在 APPEND_SYSTEM.md 中放什么 |
|---|---|
| 🧠 **人生教练** | 你的目标、你正在培养的习惯、写日记的提示 |
| 🏠 **家庭管家** | 购物清单格式、家人的偏好、膳食计划 |
| 💼 **工作伙伴** | 你的职责、当前项目、会议记录格式、公司背景 |
| 📚 **学习伙伴** | 你在学什么、偏好的讲解方式、测验模式 |
| ✍️ **写作助理** | 你的写作风格、语气偏好、你常用的格式 |

## 添加更多背景信息

你可以在助理文件夹中放入任何有助于 pi 更有用的内容：

- `notes/` — 你的助理可以阅读的参考文件
- `context.md` — 关于你的生活或工作的背景信息
- `projects.md` — 当前项目及其状态

pi 可以读取该文件夹中的文件，所以你给的背景信息越多，它就越聪明。

## 让 pi-web 帮你做事

在 `pi install npm:@ygncode/pi-web@beta` 之后，会话就可以与 pi-web 本身对话了。
试试：

- “添加一个新加坡时间凌晨 2 点的日程来总结我的收件箱”
- “列出我的 pi-web 日程”
- “暂停收件箱日程”
- “把这个写进笔记里”
- “把 pi-web 切换为深色模式 / 关闭自动标题”

内置的 **/skill:pi-web-schedule** 技能会把它变成真正的 pi-web
日程（就是你在 `/schedules` 中编辑的那些）。每次触发都会启动一个**新的**
会话，所以指令必须自包含——“总结 ~/inbox 中的未读邮件”可行；“继续我们刚才在做的事”不行。

日程只有在 pi-web 运行时才会执行。

---

> 💡 **提示：** 从简单开始。只用几行文字说明你是谁、你希望助理如何行事。随着你逐渐了解什么方法有效，再慢慢迭代。
