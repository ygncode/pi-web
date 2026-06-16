# Instalación y Uso

## Funcionalidades

### Control remoto

- Continúa cualquier sesión desde el navegador con adjuntos de texto o imágenes
- Inicia una sesión completamente nueva en cualquier ruta de proyecto, directamente desde la interfaz web
- Cambio de modelo y selector de nivel de pensamiento en el navegador, por sesión
- Estado del worker por sesión (inactivo / ejecutándose / error) con recuperación automática ante fallos
- Múltiples sesiones se ejecutan en paralelo — lanza trabajo en una, observa el streaming en otra
- `PI_WEB_TOKEN` para exposición segura en LAN — requerido por defecto para cualquier enlace explícito que no sea loopback

### Lectura de sesiones

- Explora sesiones entre proyectos con filtros, búsqueda y navegación completa por ramas
- Actualizaciones incrementales en vivo mientras pi está ejecutándose (vía fsnotify; latencia de ~ms)
- Modo seguimiento para observar sesiones activas en tiempo real
- Enlaces profundos a mensajes individuales
- Descarga una sesión como JSONL
- Comparte instantáneas estáticas como Gists secretos de GitHub
- Extensiones `/web`, `/remote`, `/refresh`, `/pi-web token` y `/pi-web set-token` de pi para abrir sesiones, QR remoto, sincronización de sesiones y gestión de tokens

## Requisitos

- [Go](https://go.dev) 1.25+
- `pi` en tu `PATH` para el chat en navegador y cambio de modelo
- Opcional: `gh` para compartir

## Instalación

### Paquete de pi (recomendado)

```bash
pi install npm:@ygncode/pi-web@beta
```

Este único comando:
- Instala el paquete npm de pi en el directorio de paquetes de pi
- Ejecuta el script `postinstall` del paquete (`bash install.sh`)
- Descarga el binario de pi-web correspondiente a tu versión del paquete y plataforma desde GitHub Releases
- Lo instala en `~/.pi/agent/bin/pi-web`
- Configura el inicio automático al iniciar sesión (launchd en macOS, systemd en Linux)
- Registra los comandos de pi `/web`, `/remote`, `/refresh`, `/pi-web token` y `/pi-web set-token`

El auto-titulado de sesiones está integrado en pi-web (no en la extensión) y se configura en la página `/settings`. Está activado por defecto: pi-web nombra las sesiones automáticamente usando una heurística gratuita de palabras incorporada (sin IA), re-titulando en cada nuevo mensaje. Puedes cambiar a titular una vez por sesión, y/o elegir un modelo para que escriba títulos más inteligentes en lugar de la heurística.

En Linux, el inicio automático se configura como un servicio systemd de usuario en `~/.config/systemd/user/pi-web.service`. El instalador reescribe su `ExecStart` con la ruta real del binario instalado. Si Tailscale está disponible en tiempo de ejecución, pi-web publica el servidor localhost con Tailscale Serve HTTPS. Si systemd de usuario no está disponible, ejecútalo manualmente con `~/.pi/agent/bin/pi-web -o`.

Para instalar solo para un proyecto específico (compartido con tu equipo mediante `.pi/settings.json`):

```bash
pi install -l npm:@ygncode/pi-web@beta
```

Luego reinicia pi (o ejecuta `/reload`), y usa `/web`, `/pi-web`, `/remote`, `/refresh`. Gestiona tu token de acceso con `/pi-web token` y `/pi-web set-token`.

Si npm aborta con `ENOTEMPTY` al renombrar `@ygncode/pi-web`, elimina los directorios de respaldo ocultos obsoletos de npm y reinstala el canal beta:

```bash
rm -rf ~/.pi/agent/npm/node_modules/@ygncode/.pi-web-*
pi install npm:@ygncode/pi-web@beta
```

### Instalación rápida (sin necesidad de herramientas de compilación)

```bash
curl -fsSL https://raw.githubusercontent.com/ygncode/pi-web/main/install.sh | bash
```

Esto descarga el último binario de pi-web, lo instala en `/usr/local/bin` y configura el inicio automático al iniciar sesión. No se requiere Go, Node ni pi.

### Descargar binario

Hay binarios precompilados adjuntos a cada [GitHub Release](https://github.com/ygncode/pi-web/releases).

```bash
# macOS (Apple Silicon)
curl -L -o pi-web https://github.com/ygncode/pi-web/releases/latest/download/pi-web-darwin-arm64
chmod +x pi-web

# macOS (Intel)
curl -L -o pi-web https://github.com/ygncode/pi-web/releases/latest/download/pi-web-darwin-amd64
chmod +x pi-web

# Linux (amd64)
curl -L -o pi-web https://github.com/ygncode/pi-web/releases/latest/download/pi-web-linux-amd64
chmod +x pi-web

# Linux (arm64)
curl -L -o pi-web https://github.com/ygncode/pi-web/releases/latest/download/pi-web-linux-arm64
chmod +x pi-web
```

Luego muévelo a tu PATH:

```bash
cp pi-web ~/.pi/agent/bin/
# o a nivel de sistema:
sudo cp pi-web /usr/local/bin/
```

### Compilar desde el código fuente

```bash
git clone https://github.com/ygncode/pi-web.git
cd pi-web
make build   # compila el bundle de Vite y luego lo incrusta en el binario Go

# opcional: colócalo en el PATH
cp pi-web ~/.pi/agent/bin/
```

El bundle del frontend es incrustado por `web/assets_embed.go`, por lo que `go build` necesita
que `web/dist` exista primero. `make build` realiza ambos pasos en orden; si compilas
manualmente, ejecuta `npm --prefix web install && npm --prefix web run build` antes de
`go build ./cmd/pi-web`.

## Desinstalación

```bash
pi remove npm:@ygncode/pi-web@beta
```

Esto ejecuta el script `preuninstall` del paquete (`bash uninstall.sh`), que detiene
la instancia en ejecución y elimina:

- el binario de pi-web (`~/.pi/agent/bin/pi-web`, o `/usr/local/bin/pi-web` para instalaciones independientes)
- el archivo de versión (`~/.pi/agent/pi-web-version`)
- el archivo de estado en tiempo de ejecución (`~/.pi/agent/pi-web/pi-web-state.json`)
- la configuración de inicio automático (plist de launchd en macOS, servicio systemd de usuario en Linux)

Tus datos se conservan para que una reinstalación posterior retome donde lo dejaste:
`~/.pi/agent/pi-web.sqlite`, `~/.pi/agent/pi-web-memory.sqlite`, tus archivos de sesión
en `~/.pi/agent/sessions/`, y `~/.config/pi-web/env` (incluyendo
`PI_WEB_TOKEN`). Elimínalos manualmente si quieres empezar desde cero.

## Uso

```bash
# Iniciar en el puerto predeterminado (31415)
pi-web

# Iniciar y abrir un navegador
pi-web -o

# Puerto personalizado
pi-web -p 8080

# Sobrescribir el host de enlace (loopback no requiere autenticación por defecto)
pi-web --host 127.0.0.1

# Un enlace que no sea loopback requiere un token — pi-web se niega a iniciar sin él
PI_WEB_TOKEN=$(openssl rand -hex 16) pi-web --host 192.168.1.50
```

Por defecto, pi-web se enlaza a `127.0.0.1`. Si Tailscale está ejecutándose con MagicDNS, pi-web también ejecuta `tailscale serve --bg --https=<puerto> http://127.0.0.1:<puerto>` e imprime la URL HTTPS de la tailnet. Cualquier enlace explícito que no sea loopback requiere que `PI_WEB_TOKEN` esté configurado; usa `--insecure` para omitirlo en pruebas locales.

## Acceso Remoto

Deja pi-web escuchando localmente y luego usa la URL HTTPS de Tailscale impresa desde tu teléfono o portátil en la tailnet.

En Linux, permite que tu usuario gestione Tailscale antes de instalar/ejecutar pi-web, de lo contrario `tailscale serve` puede requerir sudo y el inicio automático puede fallar:

```bash
sudo tailscale set --operator=$USER
```

```bash
# 1. Inicia pi-web
pi-web

# 2. Desde cualquier otro dispositivo conectado a Tailscale, abre la URL
#    "Tailscale HTTPS" impresa.
```

> Por defecto, pi-web se niega a enlazarse a una dirección que no sea loopback a menos que `PI_WEB_TOKEN` esté configurado — cualquiera que pueda alcanzar la dirección enlazada podría ver sesiones y enviar instrucciones a pi. Para omitir esta protección en pruebas de red local, usa `--insecure`. **No uses `--insecure` en Tailscale ni en ninguna dirección accesible desde fuera de tu máquina.**
>
> Los clientes pueden pasar el token mediante la cabecera `Authorization: Bearer <token>`, la cabecera `X-Pi-Token`, o una vez mediante `?token=<token>` (lo que establece una cookie `pi_token` para solicitudes posteriores). Los tokens pasados mediante `?token=` terminan en el historial del navegador, los registros de acceso del servidor y las cabeceras `Referer` de cualquier enlace en la página — prefiere la forma de cabecera para cualquier cosa que vaya más allá del marcador inicial.

## Chat en el Navegador

Abre una página de sesión y usa el compositor en la parte inferior para continuar esa sesión exacta.

- `Enter` envía, `Shift+Enter` inserta un salto de línea
- Arrastra y suelta o pega imágenes directamente en el compositor
- El selector de modelo y el selector de nivel de pensamiento se encuentran en la cabecera — los cambios se aplican al worker de pi subyacente inmediatamente
- Cada sesión activa obtiene su propio worker dedicado `pi --mode rpc`, por lo que las sesiones diferentes no se bloquean entre sí

## Compartir Sesiones

Haz clic en **Compartir** en una página de sesión para crear un Gist secreto de GitHub.

Requisitos:
- `gh` instalado
- `gh auth login` completado

Compartir devuelve:
- la URL del gist secreto
- una URL de vista previa en `https://pi.dev/session/#<gistId>`

Los gists compartidos son instantáneas y no se actualizan en vivo.

## Inicio Automático al Iniciar Sesión

### macOS

```bash
cp init/com.pi-web.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.pi-web.plist
```

### Linux (systemd)

```bash
# Instalar el servicio systemd de usuario
mkdir -p ~/.config/systemd/user
cp init/pi-web.service ~/.config/systemd/user/

# Opcional: configura tu PI_WEB_TOKEN para enlaces no-loopback
# (o usa /pi-web set-token <token> desde dentro de pi)
mkdir -p ~/.config/pi-web
echo 'PI_WEB_TOKEN=tu-token-aqui' > ~/.config/pi-web/env

# Habilitar e iniciar
systemctl --user daemon-reload
systemctl --user enable --now pi-web.service

# Verificar estado
systemctl --user status pi-web.service

# Ver registros
journalctl --user -u pi-web.service -f
```

> Para que el servicio se inicie en el arranque (antes de iniciar sesión), usa un servicio de sistema en su lugar:
> copia `init/pi-web.service` a `/etc/systemd/system/` y usa `sudo systemctl`.
