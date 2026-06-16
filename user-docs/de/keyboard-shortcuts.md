# Tastaturkürzel

## Index-Seite (`/`)

### Seiten-Scrolling (Vim-Stil)

Dieselben Vim-artigen Tastaturkürzel funktionieren auf allen Seiten, wenn der Fokus **nicht** in einem input-, textarea- oder contenteditable-Element liegt.

| Tastaturkürzel | Aktion |
|----------|--------|
| `j` | 300px nach unten scrollen |
| `k` | 300px nach oben scrollen |
| `g g` | Zum Seitenanfang scrollen |
| `G` (Umschalt+G) | Zum Seitenende scrollen |
| `Escape` | Das aktive Eingabefeld verlassen, damit die j/k-Navigation funktioniert |

### Index-Befehle

| Tastaturkürzel | Kontext | Aktion |
|----------|---------|--------|
| `⌘K` / `Ctrl+K` | Seitenweit | Such-/Sitzungs-Palette öffnen |
| `⌘⇧L` / `Ctrl+Shift+L` | Seitenweit | System-Design umschalten (hell/dunkel) |
| `Escape` | Seitenweit | Palette, Menü oder Modal schließen |
| `Enter` | Pfadeingabe für neue Sitzung | Neue Sitzung erstellen |

> `⌘K` / `Ctrl+K` ist auch Chromes Tastaturkürzel „Adressleiste fokussieren". Der Browser kann es abfangen, es sei denn, der Fokus befindet sich in einem Texteingabefeld.

## Sitzungsdetailseite (`/session?id=...`)

### Seiten-Scrolling (Vim-Stil)

Diese funktionieren sowohl auf der Index- als auch auf der Sitzungsseite, wenn der Fokus **nicht** in einem input-, textarea- oder contenteditable-Element liegt.

| Tastaturkürzel | Aktion |
|----------|--------|
| `j` | 300px nach unten scrollen |
| `k` | 300px nach oben scrollen |
| `g g` | Zum Seitenanfang scrollen |
| `G` (Umschalt+G) | Zum Seitenende scrollen |
| `I` (Umschalt+I) | Das Chat-Textfeld fokussieren |
| `Escape` | Das aktive Eingabefeld verlassen, damit die j/k-Navigation funktioniert |

### Seitenleiste & Navigation

| Tastaturkürzel | Kontext | Aktion |
|----------|---------|--------|
| `⌘B` / `Ctrl+B` | Seitenweit | Sichtbarkeit der Seitenleiste umschalten |
| `⌘K` / `Ctrl+K` | Seitenweit | Sitzungslisten-Palette öffnen |
| `⌘T` / `Ctrl+T` | Seitenweit | Neue Sitzung |
| `⌘⇧L` / `Ctrl+Shift+L` | Seitenweit | System-Design umschalten (hell/dunkel) |
| `⌘⇧N` / `Ctrl+Shift+N` | Seitenweit | Notizblock-/Notizen-Seitenleiste umschalten |

> `⌘K` und `⌘T` sind auch Browser-Tastaturkürzel (Adressleiste fokussieren / neuer Tab). Der Browser kann sie abfangen, es sei denn, der Fokus befindet sich in einem Texteingabefeld.

### Chat-Eingabe

| Tastaturkürzel | Kontext | Aktion |
|----------|---------|--------|
| `Enter` | Chat-Textfeld | Nachricht senden |
| `Umschalt+Enter` | Chat-Textfeld | Zeilenumbruch einfügen |
| `Umschalt+Tab` | Chat-Textfeld | Zum nächsten Thinking-Level wechseln (`off` → `minimal` → … → `xhigh` → `off`) |
| `Ctrl+I` / `Ctrl+L` | Chat-Textfeld | Modellauswahl-Popup öffnen (tippen zum Filtern, Enter zum Auswählen, Fokus kehrt zum Textfeld zurück) |

### Eintrag-Sichtbarkeitsumschalter

| Tastaturkürzel | Kontext | Aktion |
|----------|---------|--------|
| `t` | Wenn der Fokus **nicht** in einem input/textarea liegt | Sichtbarkeit von Thinking umschalten |
| `o` | Wenn der Fokus **nicht** in einem input/textarea liegt | Sichtbarkeit von Tools umschalten |
| `p` | Wenn der Fokus **nicht** in einem input/textarea liegt | Sichtbarkeit von Tool-Ausgaben umschalten |

### Paletten, Menüs & Sheets

| Tastaturkürzel | Kontext | Aktion |
|----------|---------|--------|
| `Escape` | Seitenweit | Alle geöffneten Paletten, Menüs oder Sheets schließen |
| `⌘K` / `Ctrl+K` | Seitenweit | Sitzungslisten-Palette öffnen |
| `Pfeil hoch` / `Pfeil runter` | Sitzungslisten-Palette | Sitzungsergebnisse navigieren |
| `Enter` | Sitzungslisten-Palette | Die ausgewählte (oder erste) Sitzung öffnen |
| `Pfeil hoch` / `Pfeil runter` | Modellauswahl-Popup | Modellliste navigieren |
| `Enter` | Modellauswahl-Popup | Hervorgehobenes Modell auswählen |
| `Pfeil hoch` / `Pfeil runter` | Fork-Modal | Nachrichten navigieren |
| `Enter` | Fork-Modal | Von hervorgehobener Nachricht forken |
| `Tab` | Vollbild-Sheet | Fokus innerhalb des Sheets durchwechseln |
| `Escape` | Vollbild-Sheet | Das Sheet schließen |
