<h1 align="center">pi-web (Remote Control Your Pi)</h1>

<div align="center">

[![GitHub stars](https://img.shields.io/github/stars/ygncode/pi-web?style=flat&logo=github&label=stars&cacheSeconds=86400)](https://github.com/ygncode/pi-web/stargazers)
[![npm downloads](https://img.shields.io/npm/dw/@ygncode/pi-web?label=downloads/wk&color=2ea043&cacheSeconds=86400)](https://www.npmjs.com/package/@ygncode/pi-web)
[![license MIT](https://img.shields.io/npm/l/@ygncode/pi-web?label=license&color=0a7bbb&cacheSeconds=86400)](../../LICENSE)
[![Telegram](https://img.shields.io/badge/Telegram-Join-26A5E4?logo=telegram&logoColor=white)](https://t.me/+NJvFOTTa0wNjNTc9)
![platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-555)

[English](../../README.md) · **Español** · [Français](README.fr.md) · [Deutsch](README.de.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [Bahasa Indonesia](README.id.md) · [Bahasa Melayu](README.ms.md) · [Tiếng Việt](README.vi.md) · [ไทย](README.th.md) · [Filipino](README.fil.md) · [မြန်မာ](README.my.md) · [ភាសាខ្មែរ](README.km.md) · [ລາວ](README.lo.md)

</div>

<div align="center">

Controla tu [pi](https://pi.dev) coding agent desde tu teléfono, tableta o portátil — desde cualquier lugar de tu red, o de forma remota a través de Tailscale.

Es una PWA completa, por lo que puedes instalarla y usarla como una app nativa en cualquier dispositivo. Piensa en ello como tu propio espacio de trabajo de IA personal — como Cowork de Claude, pero con diferentes modelos — chatea entre modelos, programa desde tu teléfono o conviértelo en un [asistente personal](user-docs/en/personal-assistant.md) que vive en tu máquina.

Hazlo tuyo: cambia temas y fuentes, y úsalo en tu propio idioma — pi-web incluye varios idiomas y puedes añadir el tuyo. Más funciones están en camino, pero no se volverá inflado: todo lo que no necesites se puede desactivar en la configuración.

</div>

> [!WARNING]
> pi-web está actualmente en **beta**. ¡Las cosas cambiarán y se romperán!

> [!TIP]
> ¿Nuevo aquí? **[Lee la guía de usuario →](user-docs/en/README.md)** para un recorrido completo de funciones, pasos de instalación y consejos. ([Otros idiomas →](../README.md))

## Capturas de pantalla

<div align="center">
  <img src="../assets/pi-web-desktop-screenshot.png" alt="Desktop" width="90%" /><br />
  <em>Escritorio</em>
  <br /><br />
  <img src="../assets/pi-web-mobile-screenshot.png" alt="Mobile PWA" width="90%" /><br />
  <em>PWA móvil</em>
</div>

## Cómo encaja todo

```
 pi (terminal)                 Browser (phone / tablet / laptop)
      │                                │
      │  writes JSONL                  │  HTTP + SSE
      ▼                                ▼
 ~/.pi/agent/sessions/  ←───  pi-web (Go HTTP server)
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
              pi --mode rpc      fsnotify         tailscale serve
            (per‑session       (live reload)      (remote HTTPS
             chat worker)                           via MagicDNS)
```

- **pi** escribe la conversación en JSONL en `~/.pi/agent/sessions/` mientras trabaja.
- **pi-web** es un servidor Go que lee esos archivos, los renderiza en el navegador y transmite actualizaciones en vivo vía SSE.
- Los workers **pi --mode rpc** gestionan el chat iniciado desde el navegador — uno por sesión, eliminados tras 10 min de inactividad.
- **fsnotify** vigila el directorio de sesiones para que el navegador se recargue en milisegundos tras nueva salida.
- **Tailscale Serve** publica el servidor localhost como un endpoint HTTPS en tu tailnet.

## Instalación

```bash
pi install npm:@ygncode/pi-web@beta
```

Eso es todo — descarga el binario correspondiente, configura el inicio automático y registra los comandos `/web`, `/pi-web`, `/remote` y `/refresh`.

Una vez instalado, abre `http://127.0.0.1:31415` en tu navegador. Desde pi, usa `/web` para abrir la sesión actual en tu navegador al instante. Si Tailscale se está ejecutando en tu máquina, pi-web publica automáticamente un endpoint HTTPS en tu tailnet — usa `/remote` desde pi para obtener un código QR y una URL para cualquier dispositivo en tu tailnet.

Para instalaciones manuales, descargas de binarios o compilación desde el código fuente, consulta [user-docs/install.md](user-docs/en/install.md).

## Integración con Pi

Después de `pi install npm:@ygncode/pi-web@beta`, obtienes:

| Comando | Qué hace |
|---------|----------|
| `/web` | Abre la sesión actual en tu navegador (consciente de SSH: omite el navegador y solo muestra la URL) |
| `/pi-web` | Muestra estado, versión, inicia/detiene/reinicia el servidor, o actualiza |
| `/remote` | Muestra un código QR y una URL para acceso remoto a través de Tailscale |
| `/refresh` | Trae los nuevos mensajes escritos desde navegadores remotos de vuelta a la sesión de terminal |

El **auto-titulado** de sesiones está integrado en pi-web y se configura en la página `/settings`. Está **activado por defecto** y nombra las sesiones automáticamente. Puedes elegir:

- **Cuándo titular** — una vez por sesión, o en cada nuevo mensaje (por defecto).
- **Modelo de título** — una **heurística de palabras integrada (sin IA)** gratuita e instantánea por defecto, o elige un modelo (p.ej. uno pequeño/rápido) para títulos más inteligentes escritos por el modelo.

El paquete también instala el binario de pi-web en `~/.pi/agent/bin/pi-web` y configura el inicio automático al iniciar sesión.

## Inicio automático al iniciar sesión

El comando `pi install npm:@ygncode/pi-web@beta` configura esto automáticamente:

| SO | Mecanismo |
|----|-----------|
| macOS | launchd plist en `~/Library/LaunchAgents/com.pi-web.plist` |
| Linux | servicio systemd de usuario en `~/.config/systemd/user/pi-web.service` |

Para establecer un token para acceso remoto, crea `~/.config/pi-web/env`:

```
PI_WEB_TOKEN=your-token-here
```

Para más detalles (configuración manual, puertos personalizados, binds no loopback), consulta [user-docs/install.md](user-docs/en/install.md).

## Desarrollo

```bash
make setup   # install frontend deps and download Go modules
make check   # frontend test/build + Go test/vet
make build   # setup if needed, build frontend, then build ./pi-web
```
