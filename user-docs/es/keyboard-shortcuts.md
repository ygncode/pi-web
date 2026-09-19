# Atajos de teclado

## Página de índice (`/`)

### Desplazamiento de página (estilo vim)

Los mismos atajos de estilo vim funcionan en todas las páginas cuando el foco **no** está en un input, textarea o elemento contenteditable.

| Atajo | Acción |
|----------|--------|
| `j` | Desplazarse hacia abajo 300px |
| `k` | Desplazarse hacia arriba 300px |
| `g g` | Desplazarse al inicio de la página |
| `G` (Shift+G) | Desplazarse al final de la página |
| `Escape` | Quitar el foco del input activo para que la navegación con j/k funcione |

### Comandos del índice

| Atajo | Contexto | Acción |
|----------|---------|--------|
| `⌘K` / `Ctrl+K` | Nivel de página | Abrir la paleta de búsqueda/sesiones |
| `⌘,` / `Ctrl+,` | Nivel de página | Abrir ajustes |
| `⌘⇧L` / `Ctrl+Shift+L` | Nivel de página | Alternar tema del sistema (claro/oscuro) |
| `Escape` | Nivel de página | Cerrar paleta, menú o modal |
| `Enter` | Input de ruta de nueva sesión | Crear nueva sesión |

> `⌘K` / `Ctrl+K` también es el atajo de Chrome para "enfocar la barra de direcciones". El navegador puede interceptarlo a menos que el foco esté dentro de un campo de texto.

## Página de detalle de sesión (`/session?id=...`)

### Desplazamiento de página (estilo vim)

Estos funcionan tanto en la página de índice como en la de sesión cuando el foco **no** está en un input, textarea o elemento contenteditable.

| Atajo | Acción |
|----------|--------|
| `j` | Desplazarse hacia abajo 300px |
| `k` | Desplazarse hacia arriba 300px |
| `g g` | Desplazarse al inicio de la página |
| `G` (Shift+G) | Desplazarse al final de la página |
| `I` (Shift+I) | Enfocar el textarea del compositor de chat |
| `Escape` | Quitar el foco del input activo para que la navegación con j/k funcione |

### Barra lateral y navegación

| Atajo | Contexto | Acción |
|----------|---------|--------|
| `⌘B` / `Ctrl+B` | Nivel de página | Alternar visibilidad de la barra lateral |
| `⌘K` / `Ctrl+K` | Nivel de página | Abrir la paleta de lista de sesiones |
| `⌘T` / `Ctrl+T` | Nivel de página | Nueva sesión |
| `⌘/` / `Ctrl+/` | Nivel de página | Mostrar el modal de atajos de teclado |
| `⌘,` / `Ctrl+,` | Nivel de página | Abrir ajustes |
| `⌘⇧L` / `Ctrl+Shift+L` | Nivel de página | Alternar tema del sistema (claro/oscuro) |
| `⌘⇧N` / `Ctrl+Shift+N` | Nivel de página | Alternar la barra lateral de apuntes / notas |

> `⌘K` y `⌘T` también son atajos del navegador (enfocar la barra de direcciones / nueva pestaña). El navegador puede interceptarlos a menos que el foco esté dentro de un campo de texto.

### Compositor de chat

| Atajo | Contexto | Acción |
|----------|---------|--------|
| `Enter` | Textarea del chat | Enviar mensaje |
| `Shift+Enter` | Textarea del chat | Insertar salto de línea |
| `Shift+Tab` | Textarea del chat | Pasar al siguiente nivel de pensamiento (`off` → `minimal` → … → `xhigh` → `off`) |
| `Ctrl+I` / `Ctrl+L` | Textarea del chat | Abrir el selector de modelo emergente (escribe para filtrar, Enter para seleccionar, el foco vuelve al textarea) |

### Interruptores de visibilidad de entradas

| Atajo | Contexto | Acción |
|----------|---------|--------|
| `t` | Cuando el foco **no** está en un input/textarea | Alternar visibilidad del pensamiento |
| `o` | Cuando el foco **no** está en un input/textarea | Alternar visibilidad de herramientas |
| `p` | Cuando el foco **no** está en un input/textarea | Alternar salidas de herramientas |

### Paletas, menús y hojas

| Atajo | Contexto | Acción |
|----------|---------|--------|
| `Escape` | Nivel de página | Cerrar cualquier paleta, menú u hoja abiertos |
| `⌘K` / `Ctrl+K` | Nivel de página | Abrir la paleta de lista de sesiones |
| `ArrowUp` / `ArrowDown` | Paleta de lista de sesiones | Navegar por los resultados de sesiones |
| `Enter` | Paleta de lista de sesiones | Abrir la sesión seleccionada (o la primera) |
| `ArrowUp` / `ArrowDown` | Selector de modelo emergente | Navegar por la lista de modelos |
| `Enter` | Selector de modelo emergente | Seleccionar el modelo resaltado |
| `ArrowUp` / `ArrowDown` | Modal de bifurcación | Navegar por los mensajes |
| `Enter` | Modal de bifurcación | Bifurcar desde el mensaje resaltado |
| `Tab` | Hoja a pantalla completa | Ciclar el foco dentro de la hoja |
| `Escape` | Hoja a pantalla completa | Cerrar la hoja |
