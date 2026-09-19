# Tastenkombinationen

## Indexseite (`/`)

### Seiten-Scrolling (Vim-Stil)

Dieselben Vim-Kürzel funktionieren auf allen Seiten, wenn der Fokus **nicht** in einem input-, textarea- oder contenteditable-Element liegt.

| Kürzel | Aktion |
|----------|--------|
| `j` | 300px nach unten scrollen |
| `k` | 300px nach oben scrollen |
| `g g` | Zum Seitenanfang scrollen |
| `G` (Shift+G) | Zum Seitenende scrollen |
| `Escape` | Fokus des aktiven Eingabefelds aufheben, damit die j/k-Navigation funktioniert |

### Index-Befehle

| Kürzel | Kontext | Aktion |
|----------|---------|--------|
| `⌘K` / `Ctrl+K` | Seitenebene | Such-/Sitzungs-Palette öffnen |
| `⌘,` / `Ctrl+,` | Seitenebene | Einstellungen öffnen |
| `⌘⇧L` / `Ctrl+Shift+L` | Seitenebene | System-Theme umschalten (hell/dunkel) |
| `Escape` | Seitenebene | Palette, Menü oder Modal schließen |
| `Enter` | Eingabefeld „Neue Sitzung" | Neue Sitzung erstellen |

> `⌘K` / `Ctrl+K` ist auch das Chrome-Kürzel „Adressleiste fokussieren". Der Browser kann es abfangen, es sei denn, der Fokus liegt in einem Texteingabefeld.

## Sitzungsdetailseite (`/session?id=...`)

### Seiten-Scrolling (Vim-Stil)

Diese funktionieren sowohl auf der Index- als auch auf der Sitzungsseite, wenn der Fokus **nicht** in einem input-, textarea- oder contenteditable-Element liegt.

| Kürzel | Aktion |
|----------|--------|
| `j` | 300px nach unten scrollen |
| `k` | 300px nach oben scrollen |
| `g g` | Zum Seitenanfang scrollen |
| `G` (Shift+G) | Zum Seitenende scrollen |
| `I` (Shift+I) | Chat-Eingabe-Textarea fokussieren |
| `Escape` | Fokus des aktiven Eingabefelds aufheben, damit die j/k-Navigation funktioniert |

### Seitenleiste & Navigation

| Kürzel | Kontext | Aktion |
|----------|---------|--------|
| `⌘B` / `Ctrl+B` | Seitenebene | Sichtbarkeit der Seitenleiste umschalten |
| `⌘K` / `Ctrl+K` | Seitenebene | Sitzungslisten-Palette öffnen |
| `⌘T` / `Ctrl+T` | Seitenebene | Neue Sitzung |
| `⌘/` / `Ctrl+/` | Seitenebene | Modal mit Tastenkombinationen anzeigen |
| `⌘,` / `Ctrl+,` | Seitenebene | Einstellungen öffnen |
| `⌘⇧L` / `Ctrl+Shift+L` | Seitenebene | System-Theme umschalten (hell/dunkel) |
| `⌘⇧N` / `Ctrl+Shift+N` | Seitenebene | Scratchpad-/Notizen-Seitenleiste umschalten |

> `⌘K` und `⌘T` sind auch Browser-Kürzel (Adressleiste fokussieren / neuer Tab). Der Browser kann sie abfangen, es sei denn, der Fokus liegt in einem Texteingabefeld.

### Chat-Eingabe

| Kürzel | Kontext | Aktion |
|----------|---------|--------|
| `Enter` | Chat-Textarea | Nachricht senden |
| `Shift+Enter` | Chat-Textarea | Zeilenumbruch einfügen |
| `Shift+Tab` | Chat-Textarea | Zur nächsten Denkstufe wechseln (`off` → `minimal` → … → `xhigh` → `off`) |
| `Ctrl+I` / `Ctrl+L` | Chat-Textarea | Modellauswahl-Popup öffnen (zum Filtern tippen, mit Enter auswählen, Fokus kehrt zur Textarea zurück) |

### Sichtbarkeits-Umschalter für Einträge

| Kürzel | Kontext | Aktion |
|----------|---------|--------|
| `t` | Wenn der Fokus **nicht** in einem Eingabefeld/einer Textarea liegt | Sichtbarkeit des Denkens umschalten |
| `o` | Wenn der Fokus **nicht** in einem Eingabefeld/einer Textarea liegt | Sichtbarkeit der Tools umschalten |
| `p` | Wenn der Fokus **nicht** in einem Eingabefeld/einer Textarea liegt | Tool-Ausgaben umschalten |

### Paletten, Menüs & Sheets

| Kürzel | Kontext | Aktion |
|----------|---------|--------|
| `Escape` | Seitenebene | Jede offene Palette, jedes offene Menü oder Sheet schließen |
| `⌘K` / `Ctrl+K` | Seitenebene | Sitzungslisten-Palette öffnen |
| `ArrowUp` / `ArrowDown` | Sitzungslisten-Palette | Durch Sitzungsergebnisse navigieren |
| `Enter` | Sitzungslisten-Palette | Ausgewählte (oder erste) Sitzung öffnen |
| `ArrowUp` / `ArrowDown` | Modellauswahl-Popup | Durch Modellliste navigieren |
| `Enter` | Modellauswahl-Popup | Hervorgehobenes Modell auswählen |
| `ArrowUp` / `ArrowDown` | Fork-Modal | Durch Nachrichten navigieren |
| `Enter` | Fork-Modal | Von hervorgehobener Nachricht abzweigen |
| `Tab` | Vollbild-Sheet | Fokus innerhalb des Sheets durchlaufen |
| `Escape` | Vollbild-Sheet | Sheet schließen |
