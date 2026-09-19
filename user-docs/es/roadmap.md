# Hoja de ruta

pi-web está pensado para dos públicos:

- **Para desarrolladores** — que viven en la terminal, pero quieren continuar sus sesiones desde el móvil, pasarlas a un servidor remoto o vigilar tareas de larga duración desde cualquier lugar.
- **Para no desarrolladores** — que solo quieren una app de IA bonita que funcione. Ábrela, escribe, disfruta. Sin terminal, sin SSH, sin complicaciones. Como las herramientas de IA más fáciles de usar, pero con libertad de elección de modelo y transparencia de código abierto.

Esto es lo que está por venir.

---

## Ahora (lanzado)

Todo lo que aparece en [la tabla de funciones](README.md#what-you-can-do-with-pi-web) está disponible hoy.

Funciones que antes estaban en esta hoja de ruta y que ya se han lanzado:

| Función | Qué hace |
|---|---|
| **Dirección / cola** ([#46](https://github.com/ygncode/pi-web/issues/46)) | Envía instrucciones de seguimiento mientras pi sigue ejecutándose, o pon mensajes en cola para el siguiente turno. |
| **Programador** ([#44](https://github.com/ygncode/pi-web/issues/44)) | Programa avisos para que se ejecuten automáticamente — reuniones diarias, resúmenes matutinos, tareas recurrentes — desde la página `/schedules`. |
| **Valores predeterminados de visualización configurables** ([#48](https://github.com/ygncode/pi-web/issues/48)) | Define tu visibilidad preferida para el pensamiento, las herramientas y las salidas de las herramientas en todas las sesiones. |
| **Git diff** (parte de [#47](https://github.com/ygncode/pi-web/issues/47)) | Ve los cambios sin confirmar del árbol de trabajo en el modal de diff de la sesión, con comentarios de revisión. |

---

## A continuación

| # | Función | Qué hace |
|---|---|---|
| [#50](https://github.com/ygncode/pi-web/issues/50) | **Bots de Telegram y Discord** | Chatea con pi a través de Telegram o Discord: perfecto para flujos de trabajo de asistente personal sobre la marcha. |
| [#49](https://github.com/ygncode/pi-web/issues/49) | **Información de uso** | Seguimiento de tokens entre sesiones, estimación de costes y analíticas, más allá del desglose por sesión del menú de sesión. |
| [#41](https://github.com/ygncode/pi-web/issues/41) | **Comando `/compact`** | Compacta conversaciones largas directamente desde la interfaz web, sin necesidad de terminal. |

---

## Planificado

| # | Función | Qué hace |
|---|---|---|
| [#47](https://github.com/ygncode/pi-web/issues/47) | **Explorador de archivos** | Explora el árbol de archivos del proyecto directamente en pi-web. Opcional, para que no te estorbe. |
| [#43](https://github.com/ygncode/pi-web/issues/43) | **Atajos personalizables** | Reasigna cada atajo de teclado para adaptarlo a tu memoria muscular. |

---

## Visión

El objetivo a largo plazo: pi-web debería ser **la interfaz de pi**, para todo el mundo.

- **No desarrolladores**: lo abren como cualquier otra app. Eligen un modelo. Escriben. Listo. Sin línea de comandos nunca.
- **Desarrolladores**: obtienen una integración profunda — traspaso remoto, paneles de control multisesión, navegación con soporte de git y bots de mensajería.
- **Todo el mundo**: obtiene libertad de modelos, transparencia de código abierto y una interfaz que se siente cuidada en cada detalle.

---

> 💡 ¿Tienes una idea? [Abre un issue](https://github.com/ygncode/pi-web/issues/new) o únete a la discusión.
