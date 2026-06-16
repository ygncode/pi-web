# Mga Shortcut sa Keyboard

## Pahina ng Index (`/`)

### Pag-scroll ng pahina (istilong-vim)

Gumagana ang parehong mga shortcut na istilong-vim sa lahat ng pahina kapag ang focus ay **wala** sa isang input, textarea, o contenteditable na elemento.

| Shortcut | Ginagawa |
|----------|----------|
| `j` | Mag-scroll pababa ng 300px |
| `k` | Mag-scroll pataas ng 300px |
| `g g` | Mag-scroll sa itaas ng pahina |
| `G` (Shift+G) | Mag-scroll sa ibaba ng pahina |
| `Escape` | I-blur ang aktibong input para gumana ang j/k navigation |

### Mga utos sa Index

| Shortcut | Konteksto | Ginagawa |
|----------|-----------|----------|
| `⌘K` / `Ctrl+K` | Antas ng pahina | Buksan ang palette ng paghahanap/mga session |
| `⌘⇧L` / `Ctrl+Shift+L` | Antas ng pahina | I-toggle ang system theme (light/dark) |
| `Escape` | Antas ng pahina | Isara ang palette, menu, o modal |
| `Enter` | Input ng path ng bagong session | Gumawa ng bagong session |

> Ang `⌘K` / `Ctrl+K` ay shortcut din ng Chrome para sa "focus address bar". Maaaring i-intercept ito ng browser maliban kung ang focus ay nasa loob ng isang text input.

## Pahina ng detalye ng session (`/session?id=...`)

### Pag-scroll ng pahina (istilong-vim)

Gumagana ang mga ito sa parehong pahina ng index at session kapag ang focus ay **wala** sa isang input, textarea, o contenteditable na elemento.

| Shortcut | Ginagawa |
|----------|----------|
| `j` | Mag-scroll pababa ng 300px |
| `k` | Mag-scroll pataas ng 300px |
| `g g` | Mag-scroll sa itaas ng pahina |
| `G` (Shift+G) | Mag-scroll sa ibaba ng pahina |
| `I` (Shift+I) | I-focus ang textarea ng chat composer |
| `Escape` | I-blur ang aktibong input para gumana ang j/k navigation |

### Sidebar at navigation

| Shortcut | Konteksto | Ginagawa |
|----------|-----------|----------|
| `⌘B` / `Ctrl+B` | Antas ng pahina | I-toggle ang visibility ng sidebar |
| `⌘K` / `Ctrl+K` | Antas ng pahina | Buksan ang palette ng listahan ng mga session |
| `⌘T` / `Ctrl+T` | Antas ng pahina | Bagong session |
| `⌘⇧L` / `Ctrl+Shift+L` | Antas ng pahina | I-toggle ang system theme (light/dark) |
| `⌘⇧N` / `Ctrl+Shift+N` | Antas ng pahina | I-toggle ang scratchpad / notes sidebar |

> Ang `⌘K` at `⌘T` ay mga shortcut din ng browser (focus address bar / bagong tab). Maaaring i-intercept ang mga ito ng browser maliban kung ang focus ay nasa loob ng isang text input.

### Chat composer

| Shortcut | Konteksto | Ginagawa |
|----------|-----------|----------|
| `Enter` | Chat textarea | Ipadala ang mensahe |
| `Shift+Enter` | Chat textarea | Maglagay ng bagong linya |
| `Shift+Tab` | Chat textarea | Mag-ikot sa susunod na antas ng pag-iisip (`off` → `minimal` → … → `xhigh` → `off`) |
| `Ctrl+I` / `Ctrl+L` | Chat textarea | Buksan ang popup ng tagapili ng modelo (mag-type para mag-filter, Enter para pumili, babalik ang focus sa textarea) |

### Mga toggle ng visibility ng entry

| Shortcut | Konteksto | Ginagawa |
|----------|-----------|----------|
| `t` | Kapag ang focus ay **wala** sa isang input/textarea | I-toggle ang visibility ng pag-iisip |
| `o` | Kapag ang focus ay **wala** sa isang input/textarea | I-toggle ang visibility ng mga tool |
| `p` | Kapag ang focus ay **wala** sa isang input/textarea | I-toggle ang mga output ng tool |

### Mga palette, menu at sheet

| Shortcut | Konteksto | Ginagawa |
|----------|-----------|----------|
| `Escape` | Antas ng pahina | Isara ang anumang nakabukas na palette, menu, o sheet |
| `⌘K` / `Ctrl+K` | Antas ng pahina | Buksan ang palette ng listahan ng mga session |
| `ArrowUp` / `ArrowDown` | Palette ng listahan ng mga session | Mag-navigate sa mga resulta ng session |
| `Enter` | Palette ng listahan ng mga session | Buksan ang napiling (o unang) session |
| `ArrowUp` / `ArrowDown` | Popup ng tagapili ng modelo | Mag-navigate sa listahan ng mga modelo |
| `Enter` | Popup ng tagapili ng modelo | Pumili ng naka-highlight na modelo |
| `ArrowUp` / `ArrowDown` | Fork modal | Mag-navigate sa mga mensahe |
| `Enter` | Fork modal | Mag-fork mula sa naka-highlight na mensahe |
| `Tab` | Full-screen sheet | Mag-ikot ng focus sa loob ng sheet |
| `Escape` | Full-screen sheet | Isara ang sheet |
