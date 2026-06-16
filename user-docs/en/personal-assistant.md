# pi-web as Your Personal Assistant

pi-web isn't just for coding — you can turn it into a **personal AI assistant** that lives on your computer, like having your own OpenClaw or Hermes.

## How it works

You create a dedicated folder on your machine — that's where your assistant lives. Inside, you drop in an `APPEND_SYSTEM.md` file that defines who your assistant is, what it knows, and how it behaves. pi-web gives you a beautiful chat interface to talk to it from any device.

## Step by step

### 1. Create your assistant folder

Pick a folder on your computer. Something like:

```
~/my-assistant/
```

### 2. Define your assistant

Create an `APPEND_SYSTEM.md` file inside that folder. This is where you tell pi who your assistant is:

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

pi automatically appends this to every conversation's system prompt, so your assistant always knows who you are and how to help.

### 3. Start a session in that folder

In pi-web, create a new session pointed at `~/my-assistant/` (or whatever you named it). That's it — you're talking to your personal assistant.

### 4. Use it from anywhere

Install pi-web as a PWA on your phone, tablet, or laptop. Your assistant is always there — ask it anything, anytime.

## Ideas for your assistant

| Role | What to put in APPEND_SYSTEM.md |
|---|---|
| 🧠 **Life coach** | Your goals, habits you're working on, journaling prompts |
| 🏠 **Home manager** | Grocery list format, family members' preferences, meal planning |
| 💼 **Work buddy** | Your role, current projects, meeting note format, company context |
| 📚 **Study partner** | What you're learning, preferred explanation style, quiz me mode |
| ✍️ **Writing assistant** | Your writing style, tone preferences, common formats you use |

## Add more context

You can put anything in your assistant folder that helps pi be more useful:

- `notes/` — reference files your assistant can read
- `context.md` — background information about your life or work
- `projects.md` — current projects and their status

pi can read files in the folder, so the more context you give it, the better it gets.

---

> 💡 **Tip:** Start simple. Just a few lines about who you are and how you want the assistant to behave. Iterate over time as you learn what works.
