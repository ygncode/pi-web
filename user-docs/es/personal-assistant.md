# pi-web como tu Asistente Personal

pi-web no es solo para programar — puedes convertirlo en un **asistente personal de IA** que vive en tu computadora, como tener tu propio OpenClaw o Hermes.

## Cómo funciona

Creas una carpeta dedicada en tu máquina — ahí es donde vive tu asistente. Dentro, colocas un archivo `APPEND_SYSTEM.md` que define quién es tu asistente, qué sabe y cómo se comporta. pi-web te ofrece una hermosa interfaz de chat para hablar con él desde cualquier dispositivo.

## Paso a paso

### 1. Crea la carpeta de tu asistente

Elige una carpeta en tu computadora. Algo como:

```
~/my-assistant/
```

### 2. Define a tu asistente

Crea un archivo `APPEND_SYSTEM.md` dentro de esa carpeta. Aquí es donde le dices a pi quién es tu asistente:

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

pi agrega automáticamente esto al system prompt de cada conversación, para que tu asistente siempre sepa quién eres y cómo ayudarte.

### 3. Inicia una sesión en esa carpeta

En pi-web, crea una nueva sesión apuntando a `~/my-assistant/` (o como sea que la hayas nombrado). Eso es todo — ya estás hablando con tu asistente personal.

### 4. Úsalo desde cualquier lugar

Instala pi-web como PWA en tu teléfono, tableta o laptop. Tu asistente siempre está ahí — pregúntale lo que sea, cuando sea.

## Ideas para tu asistente

| Rol | Qué poner en APPEND_SYSTEM.md |
|---|---|
| 🧠 **Coach de vida** | Tus metas, los hábitos en los que estás trabajando, preguntas para el diario |
| 🏠 **Administrador del hogar** | Formato de la lista de compras, preferencias de los miembros de la familia, planificación de comidas |
| 💼 **Compañero de trabajo** | Tu rol, proyectos actuales, formato de notas de reuniones, contexto de la empresa |
| 📚 **Compañero de estudio** | Lo que estás aprendiendo, estilo de explicación preferido, modo cuestionario |
| ✍️ **Asistente de escritura** | Tu estilo de escritura, preferencias de tono, formatos comunes que usas |

## Añade más contexto

Puedes poner cualquier cosa en la carpeta de tu asistente que ayude a pi a ser más útil:

- `notes/` — archivos de referencia que tu asistente puede leer
- `context.md` — información de contexto sobre tu vida o tu trabajo
- `projects.md` — proyectos actuales y su estado

pi puede leer los archivos de la carpeta, así que cuanta más información le des, mejor funcionará.

## Pídele a pi-web que haga cosas

Después de `pi install npm:@ygncode/pi-web@beta`, las sesiones pueden hablar con el propio pi-web.
Prueba:

- "Añade una programación a las 2 a. m. hora de Singapur para resumir mi bandeja de entrada"
- "Lista mis programaciones de pi-web"
- "Pausa la programación de la bandeja de entrada"
- "Anota esto en las notas"
- "Cambia pi-web al modo oscuro / desactiva el título automático"

La skill incluida **/skill:pi-web-schedule** convierte eso en una programación real de pi-web (las mismas que editas en `/schedules`). Cada ejecución inicia una **nueva** sesión, así que las instrucciones deben ser autónomas — "resume el correo no leído en ~/inbox" funciona; "continúa con lo que estábamos haciendo" no.

Las programaciones solo se ejecutan mientras pi-web esté en funcionamiento.

---

> 💡 **Consejo:** Empieza con algo simple. Solo unas pocas líneas sobre quién eres y cómo quieres que se comporte el asistente. Itera con el tiempo a medida que aprendas qué funciona.
