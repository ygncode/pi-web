# pi-web como tu Asistente Personal

pi-web no es solo para programar — puedes convertirlo en un **asistente personal de IA** que vive en tu computadora, como tener tu propio OpenClaw o Hermes.

## Cómo funciona

Creas una carpeta dedicada en tu máquina — ahí es donde vive tu asistente. Dentro, colocas un archivo `APPEND_SYSTEM.md` que define quién es tu asistente, qué sabe y cómo se comporta. pi-web te da una interfaz de chat atractiva para hablar con él desde cualquier dispositivo.

## Paso a paso

### 1. Crea la carpeta de tu asistente

Elige una carpeta en tu computadora. Algo como:

```
~/mi-asistente/
```

### 2. Define tu asistente

Crea un archivo `APPEND_SYSTEM.md` dentro de esa carpeta. Aquí es donde le dices a pi quién es tu asistente:

```markdown
# Mi Asistente Personal

Eres Jarvis, mi asistente personal de IA. Me ayudas con:

- Planificación diaria y recordatorios
- Investigación y resúmenes
- Redacción de correos y mensajes
- Lluvia de ideas
- Hacer seguimiento de cosas que menciono

## Sobre mí

- Soy ingeniero de software y trabajo de forma remota
- Tengo un gato llamado Pixel
- Prefiero respuestas cortas y directas
- Mi zona horaria es PST

## Reglas

- Sé conciso — valoro la brevedad
- Si no sabes algo, dilo
- Recuérdame proactivamente las cosas que te pedí que registres
```

pi añade esto automáticamente al prompt del sistema de cada conversación, así tu asistente siempre sabe quién eres y cómo ayudarte.

### 3. Inicia una sesión en esa carpeta

En pi-web, crea una nueva sesión apuntando a `~/mi-asistente/` (o como la hayas nombrado). Eso es todo — estás hablando con tu asistente personal.

### 4. Úsalo desde cualquier lugar

Instala pi-web como PWA en tu teléfono, tableta o portátil. Tu asistente siempre está ahí — pregúntale lo que sea, cuando sea.

## Ideas para tu asistente

| Rol | Qué poner en APPEND_SYSTEM.md |
|---|---|
| 🧠 **Coach de vida** | Tus metas, hábitos en los que estás trabajando, ideas para escribir un diario |
| 🏠 **Administrador del hogar** | Formato de lista de compras, preferencias de los familiares, planificación de comidas |
| 💼 **Compañero de trabajo** | Tu rol, proyectos actuales, formato de notas de reuniones, contexto de la empresa |
| 📚 **Compañero de estudio** | Lo que estás aprendiendo, estilo de explicación preferido, modo de preguntas |
| ✍️ **Asistente de escritura** | Tu estilo de escritura, preferencias de tono, formatos comunes que usas |

## Añade más contexto

Puedes poner cualquier cosa en la carpeta de tu asistente que ayude a pi a ser más útil:

- `notas/` — archivos de referencia que tu asistente puede leer
- `contexto.md` — información de fondo sobre tu vida o trabajo
- `proyectos.md` — proyectos actuales y su estado

pi puede leer archivos en la carpeta, así que cuanto más contexto le des, mejor funciona.

---

> 💡 **Consejo:** Empieza simple. Solo unas pocas líneas sobre quién eres y cómo quieres que se comporte el asistente. Itera con el tiempo a medida que aprendes qué funciona.
