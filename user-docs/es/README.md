# Bienvenido a pi-web 🖥️

<div align="center">

[English](../en/README.md) · **Español** · [Français](../fr/README.md) · [Deutsch](../de/README.md) · [中文](../zh/README.md) · [日本語](../ja/README.md) · [Bahasa Indonesia](../id/README.md) · [Bahasa Melayu](../ms/README.md) · [Tiếng Việt](../vi/README.md) · [ไทย](../th/README.md) · [Filipino](../fil/README.md) · [မြန်မာ](../my/README.md) · [ភាសាខ្មែរ](../km/README.md) · [ລາວ](../lo/README.md)

</div>

**¿Estás pensando en probar pi-web? Adelante — te vas a enamorar.**

pi-web es una hermosa interfaz web y PWA para [pi](https://pi.dev) — el agente de codificación de IA de código abierto. Te permite explorar, leer y continuar tus sesiones de pi desde cualquier navegador, en cualquier dispositivo, con funciones bien pensadas en cada paso.

**pi-web está pensado para dos tipos de personas:**

- 🧑‍💻 **Para desarrolladores** — que viven en la terminal pero quieren continuar sesiones desde el móvil, pasárselas a un servidor remoto o supervisar tareas de larga duración desde cualquier lugar.
- ✨ **Para no desarrolladores** — que solo quieren una hermosa app de IA que funcione. Ábrela, escribe, fluye. Sin terminal, sin SSH, sin confusiones. Como las herramientas de IA más fáciles de usar, pero con libertad de elección de modelo y de código abierto.

---

## ¿Por qué pi-web?

Ya estás metido de lleno en el flujo de trabajo con pi en tu terminal. pi-web mantiene ese impulso cuando te alejas de tu escritorio:

- **Reanuda desde cualquier lugar** — continúa una sesión desde tu teléfono, tablet u otra computadora. Sin SSH, sin Termius — solo abre tu navegador.
- **Panel multi-sesión** — pon en marcha trabajo en una sesión mientras ves transmitir otra. Busca entre proyectos, filtra por rama, encuentra lo que necesitas rápido.
- **Base de código abierto** — pi es totalmente de código abierto e independiente del proveedor. No estás atado a un único modelo o proveedor. pi-web también es de código abierto.
- **Acceso remoto seguro** — autenticación por token integrada para que puedas exponerlo en tu LAN o en Tailscale sin preocupaciones.
- **Comparte tu trabajo** — exporta sesiones como instantáneas estáticas o Gists secretos de GitHub con un solo clic.

> ¿Tienes curiosidad por la historia? [Lee por qué lo construimos →](why.md)

---

## pi-web como tu espacio de trabajo personal de IA 🏠

pi-web es una PWA (Progressive Web App), así que puedes **instalarla como una app nativa** en tu escritorio, portátil, teléfono o tablet — sin necesidad de tienda de aplicaciones. En escritorio se abre en su propia ventana sin el chrome del navegador, así que se ve y se siente como una verdadera aplicación de escritorio.

Piensa en ello como **tu propio Claude Cowork** — un espacio de trabajo personal de IA que vive en tu máquina — excepto que es de código abierto e independiente del modelo:

- **Tú eres dueño de tu stack.** Elige cualquier modelo, cambia cuando quieras. Ejecuta uno local y tus datos nunca salen de tu máquina.
- **Personas sin conocimientos técnicos pueden usarlo.** Configura pi-web en su máquina, enséñales a usarlo una vez y listo. Tus padres, tu pareja, tus amigos no técnicos — sin terminal, sin SSH, solo una interfaz de chat familiar.
- **Una sola configuración, muchos usuarios.** Instálalo en tu escritorio y comparte tu pantalla, o exponlo en tu red doméstica y deja que los miembros de tu familia lo abran en sus propios dispositivos.

¿Quieres más que programar? Conviértelo en un [asistente personal](personal-assistant.md) dedicado que sepa quién eres y viva en tu máquina — como tu propio OpenClaw o Hermes.

> 💡 **Consejo profesional:** Instala pi-web como una PWA desde Chrome/Edge (haz clic en el icono de instalar en la barra de direcciones) o Safari (Compartir → Añadir al Dock). Se vuelve indistinguible de una app nativa.

---

## Qué puedes hacer con pi-web

| | |
|---|---|
| 📱 **PWA** | Instala pi-web como Progressive Web App en escritorio, teléfono o tablet para una sensación nativa. |
| 🔄 **Continuar sesiones** | Retoma cualquier conversación justo donde la dejaste — texto, imágenes, cambio de modelo, todo desde el navegador. |
| 🆕 **Iniciar nuevas sesiones** | Crea sesiones nuevas contra cualquier ruta de proyecto, directamente desde la interfaz web. |
| 📡 **Transmisión en vivo** | Observa las respuestas de pi transmitirse en tiempo real con latencia de ~ms. El modo de seguimiento te mantiene fijado en lo más reciente. |
| 🌲 **Vista de árbol** | Navega por el árbol de mensajes nativo de pi — ve la estructura completa de la conversación, salta a cualquier rama y bifurca desde cualquier punto. |
| 🔀 **Bifurcar sesiones** | Bifurca una sesión desde cualquier mensaje o incluso desde una llamada de herramienta específica — explora distintas direcciones sin perder tu lugar. |
| 🔍 **Explorar y buscar** | Filtra sesiones entre proyectos, busca por nombre, navega por ramas — todo tu historial de sesiones de un vistazo. |
| 🌿 **Integración con Git** | Ve la rama actual y abre un PR de GitHub directamente desde el visor de sesiones. |
| 📝 **Bloc de notas** | Anota notas, tareas pendientes o pensamientos rápidos junto a tus sesiones sin cambiar de aplicación. |
| 💬 **Anotaciones** | Resalta y comenta cualquier parte de una sesión — ideal para revisión de código, comentarios o marcar momentos clave. |
| 🎨 **Temas y personalización** | Cambia entre modo oscuro y claro, ajusta la interfaz a tu gusto — haz que pi-web se sienta *tuyo*. |
| 🌐 **Multiidioma** | 14 idiomas integrados (English, Español, Français, Deutsch, 中文, 日本語, Bahasa Indonesia, Bahasa Melayu, Tiếng Việt, ไทย, Filipino, မြန်မာ, ភាសាខ្មែរ, ລາວ). Añade tu propio idioma personalizado desde Ajustes. |
| 🐱 **Bienestar y pomodoro** | Demasiado vibe coding no es saludable. Temporizador pomodoro integrado con un compañero gato y recordatorios de sueño para mantenerte equilibrado. |
| 📤 **Compartir y exportar** | Descarga JSONL, exporta instantáneas estáticas renderizadas con el aspecto nativo de `pi.dev` de pi, o comparte como Gists privados de GitHub — todo renderizado del lado del cliente. |
| 🔔 **Sonidos de notificación** | Campanillas de notificación personalizables para eventos de sesión — mantente al tanto incluso cuando pi-web está en otra pestaña. |
| ⌨️ **Atajos de teclado** | Navegación estilo Vim, acciones rápidas — [referencia completa →](keyboard-shortcuts.md) |
| 🤖 **Asistente personal** | Convierte pi-web en tu propio asistente de IA que vive en tu computadora — como OpenClaw o Hermes. [Configúralo →](personal-assistant.md) |
| 🗓️ **Habla con horarios** | Desde una sesión de pi, di “añade un horario a las 2am hora de Singapur para …” — `/skill:pi-web-schedule`. |
| 📝 **Habla con notas y ajustes** | “Escribe esto en las notas” (`/skill:pi-web-notes`) o “cambia al modo oscuro” (`/skill:pi-web-settings`). |

---

## Navegación rápida

| Si buscas… | Lee |
|---|---|
| Cómo instalar, configurar y usar pi-web | [install.md](install.md) |
| Usar pi-web como asistente personal | [personal-assistant.md](personal-assistant.md) |
| Referencia de atajos de teclado | [keyboard-shortcuts.md](keyboard-shortcuts.md) |
| Por qué existe pi-web | [why.md](why.md) |
| Qué viene después | [roadmap.md](roadmap.md) |
| ¿Problemas de instalación? Deja que tu LLM lo arregle — pégale el enlace de llm-debug.md | [llm-debug.md](llm-debug.md) |

---

## Capturas de pantalla

| Escritorio | Móvil |
|---|---|
| ![Escritorio](../assets/pi-web-desktop-screenshot.png) | ![Móvil](../assets/pi-web-mobile-screenshot.png) |

---

## 💛 Patrocinar

pi-web está construido con amor y muchas noches largas. Pago de mi bolsillo los planes de codificación (Claude Code, OpenCode, etc.) para mantener este proyecto avanzando. Si pi-web te ha sido útil, tu apoyo significaría muchísimo.

**Formas de ayudar:**

- 💰 **[Patrocinar en GitHub](https://github.com/sponsors/setkyar)** — ayuda a cubrir las herramientas que hacen esto posible
- ☕ **[Invítame un café](https://buymeacoffee.com/setkyar)** — cada pequeña ayuda cuenta
- ⭐ **Dale estrella al repositorio** — no cuesta nada y ayuda a que más gente descubra pi-web
- 📢 **Comparte con amigos y familia** — si conoces a alguien a quien le encantaría pi-web, pásaselo

¿No puedes patrocinar? No te preocupes en absoluto — una estrella y compartirlo ayudan mucho. Gracias por estar aquí. 🙏

---

¡Feliz programación! 🚀
