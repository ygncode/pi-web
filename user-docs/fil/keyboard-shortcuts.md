# Mga Keyboard Shortcut

## Pahina ng index (`/`)

### Pag-scroll ng pahina (vim-style)

Gumagana ang parehong vim-style shortcut sa lahat ng pahina kapag ang focus ay **wala** sa isang input, textarea, o contenteditable element.

| Shortcut | Aksyon |
|----------|--------|
| `j` | Mag-scroll pababa ng 300px |
| `k` | Mag-scroll pataas ng 300px |
| `g g` | Mag-scroll sa itaas ng pahina |
| `G` (Shift+G) | Mag-scroll sa ibaba ng pahina |
| `Escape` | I-blur ang aktibong input para gumana ang j/k navigation |

### Mga command sa index

| Shortcut | Context | Aksyon |
|----------|---------|--------|
| `⌘K` / `Ctrl+K` | Page-level | Buksan ang search/sessions palette |
| `⌘,` / `Ctrl+,` | Page-level | Buksan ang settings |
| `⌘⇧L` / `Ctrl+Shift+L` | Page-level | I-toggle ang system theme (light/dark) |
| `Escape` | Page-level | Isara ang palette, menu, o modal |
| `Enter` | Input ng path para sa bagong session | Gumawa ng bagong session |

> Ang `⌘K` / `Ctrl+K` ay shortcut din ng Chrome para sa "focus address bar". Maaaring ma-intercept ito ng browser maliban kung nasa loob ng isang text input ang focus.

## Pahina ng detalye ng session (`/session?id=...`)

### Pag-scroll ng pahina (vim-style)

Gumagana ang mga ito sa parehong index at session page kapag ang focus ay **wala** sa isang input, textarea, o contenteditable element.

| Shortcut | Aksyon |
|----------|--------|
| `j` | Mag-scroll pababa ng 300px |
| `k` | Mag-scroll pataas ng 300px |
| `g g` | Mag-scroll sa itaas ng pahina |
| `G` (Shift+G) | Mag-scroll sa ibaba ng pahina |
| `I` (Shift+I) | I-focus ang chat composer textarea |
| `Escape` | I-blur ang aktibong input para gumana ang j/k navigation |

### Sidebar at navigation

| Shortcut | Context | Aksyon |
|----------|---------|--------|
| `⌘B` / `Ctrl+B` | Page-level | I-toggle ang visibility ng sidebar |
| `⌘K` / `Ctrl+K` | Page-level | Buksan ang session list palette |
| `⌘T` / `Ctrl+T` | Page-level | Bagong session |
| `⌘/` / `Ctrl+/` | Page-level | Ipakita ang keyboard shortcuts modal |
| `⌘,` / `Ctrl+,` | Page-level | Buksan ang settings |
| `⌘⇧L` / `Ctrl+Shift+L` | Page-level | I-toggle ang system theme (light/dark) |
| `⌘⇧N` / `Ctrl+Shift+N` | Page-level | I-toggle ang scratchpad / notes sidebar |

> Ang `⌘K` at `⌘T` ay mga browser shortcut din (focus address bar / bagong tab). Maaaring ma-intercept ang mga ito ng browser maliban kung nasa loob ng isang text input ang focus.

### Chat composer

| Shortcut | Context | Aksyon |
|----------|---------|--------|
| `Enter` | Chat textarea | I-submit ang message |
| `Shift+Enter` | Chat textarea | Maglagay ng newline |
| `Shift+Tab` | Chat textarea | Mag-cycle sa susunod na thinking level (`off` → `minimal` → … → `xhigh` → `off`) |
| `Ctrl+I` / `Ctrl+L` | Chat textarea | Buksan ang model selector popup (mag-type para mag-filter, Enter para pumili, babalik ang focus sa textarea) |

### Mga toggle ng visibility ng entry

| Shortcut | Context | Aksyon |
|----------|---------|--------|
| `t` | Kapag ang focus ay **wala** sa isang input/textarea | I-toggle ang visibility ng thinking |
| `o` | Kapag ang focus ay **wala** sa isang input/textarea | I-toggle ang visibility ng tools |
| `p` | Kapag ang focus ay **wala** sa isang input/textarea | I-toggle ang tool outputs |

### Mga palette, menu, at sheet

| Shortcut | Context | Aksyon |
|----------|---------|--------|
| `Escape` | Page-level | Isara ang anumang nakabukas na palette, menu, o sheet |
| `⌘K` / `Ctrl+K` | Page-level | Buksan ang session list palette |
| `ArrowUp` / `ArrowDown` | Session list palette | I-navigate ang mga resulta ng session |
| `Enter` | Session list palette | Buksan ang napiling (o unang) session |
| `ArrowUp` / `ArrowDown` | Model selector popup | I-navigate ang listahan ng model |
| `Enter` | Model selector popup | Piliin ang naka-highlight na model |
| `ArrowUp` / `ArrowDown` | Fork modal | I-navigate ang mga message |
| `Enter` | Fork modal | Mag-fork mula sa naka-highlight na message |
| `Tab` | Full-screen sheet | Mag-cycle ng focus sa loob ng sheet |
| `Escape` | Full-screen sheet | Isara ang sheet |
