# Atajos de Teclado

## Página de índice (`/`)

### Desplazamiento de página (estilo vim)

Los mismos atajos estilo vim funcionan en todas las páginas cuando el foco **no** está en un input, textarea o elemento contenteditable.

| Atajo | Acción |
|----------|--------|
| `j` | Desplazar hacia abajo 300px |
| `k` | Desplazar hacia arriba 300px |
| `g g` | Desplazar al inicio de la página |
| `G` (Shift+G) | Desplazar al final de la página |
| `Escape` | Quitar el foco del input activo para que funcione la navegación j/k |

### Comandos de índice

| Atajo | Contexto | Acción |
|----------|---------|--------|
| `⌘K` / `Ctrl+K` | Nivel de página | Abrir paleta de búsqueda/sesiones |
| `⌘⇧L` / `Ctrl+Shift+L` | Nivel de página | Alternar tema del sistema (claro/oscuro) |
| `Escape` | Nivel de página | Cerrar paleta, menú o modal |
| `Enter` | Campo de ruta de nueva sesión | Crear nueva sesión |

> `⌘K` / `Ctrl+K` también es el atajo de Chrome "enfocar barra de direcciones". El navegador puede interceptarlo a menos que el foco esté dentro de un campo de texto.

## Página de detalle de sesión (`/session?id=...`)

### Desplazamiento de página (estilo vim)

Estos funcionan tanto en páginas de índice como de sesión cuando el foco **no** está en un input, textarea o elemento contenteditable.

| Atajo | Acción |
|----------|--------|
| `j` | Desplazar hacia abajo 300px |
| `k` | Desplazar hacia arriba 300px |
| `g g` | Desplazar al inicio de la página |
| `G` (Shift+G) | Desplazar al final de la página |
| `I` (Shift+I) | Enfocar el textarea del compositor de chat |
| `Escape` | Quitar el foco del input activo para que funcione la navegación j/k |

### Barra lateral y navegación

| Atajo | Contexto | Acción |
|----------|---------|--------|
| `⌘B` / `Ctrl+B` | Nivel de página | Alternar visibilidad de la barra lateral |
| `⌘K` / `Ctrl+K` | Nivel de página | Abrir paleta de lista de sesiones |
| `⌘T` / `Ctrl+T` | Nivel de página | Nueva sesión |
| `⌘⇧L` / `Ctrl+Shift+L` | Nivel de página | Alternar tema del sistema (claro/oscuro) |
| `⌘⇧N` / `Ctrl+Shift+N` | Nivel de página | Alternar barra lateral de bloc de notas |

> `⌘K` y `⌘T` también son atajos del navegador (enfocar barra de direcciones / nueva pestaña). El navegador puede interceptarlos a menos que el foco esté dentro de un campo de texto.

### Compositor de chat

| Atajo | Contexto | Acción |
|----------|---------|--------|
| `Enter` | Textarea de chat | Enviar mensaje |
| `Shift+Enter` | Textarea de chat | Insertar nueva línea |
| `Shift+Tab` | Textarea de chat | Cambiar al siguiente nivel de pensamiento (`off` → `minimal` → … → `xhigh` → `off`) |
| `Ctrl+I` / `Ctrl+L` | Textarea de chat | Abrir ventana emergente de selector de modelo (escribe para filtrar, Enter para seleccionar, el foco vuelve al textarea) |

### Alternancia de visibilidad de entradas

| Atajo | Contexto | Acción |
|----------|---------|--------|
| `t` | Cuando el foco **no** está en un input/textarea | Alternar visibilidad de pensamiento |
| `o` | Cuando el foco **no** está en un input/textarea | Alternar visibilidad de herramientas |
| `p` | Cuando el foco **no** está en un input/textarea | Alternar salidas de herramientas |

### Paletas, menús y hojas

| Atajo | Contexto | Acción |
|----------|---------|--------|
| `Escape` | Nivel de página | Cerrar cualquier paleta, menú u hoja abierta |
| `⌘K` / `Ctrl+K` | Nivel de página | Abrir paleta de lista de sesiones |
| `ArrowUp` / `ArrowDown` | Paleta de lista de sesiones | Navegar resultados de sesiones |
| `Enter` | Paleta de lista de sesiones | Abrir la sesión seleccionada (o la primera) |
| `ArrowUp` / `ArrowDown` | Ventana emergente de selector de modelo | Navegar lista de modelos |
| `Enter` | Ventana emergente de selector de modelo | Seleccionar modelo resaltado |
| `ArrowUp` / `ArrowDown` | Modal de bifurcación | Navegar mensajes |
| `Enter` | Modal de bifurcación | Bifurcar desde el mensaje resaltado |
| `Tab` | Hoja a pantalla completa | Alternar foco dentro de la hoja |
| `Escape` | Hoja a pantalla completa | Cerrar la hoja |
