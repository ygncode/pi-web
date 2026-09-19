# Instalación y uso

## Funciones

### Control remoto

- Continúa cualquier sesión desde el navegador con adjuntos de texto o imágenes
- Inicia una sesión completamente nueva contra cualquier ruta de proyecto, directamente desde la interfaz web
- Cambio de modelo en el navegador y selector de nivel de pensamiento, por sesión
- Estado del worker por sesión (inactivo / ejecutándose / error) con recuperación automática ante fallos
- Varias sesiones se ejecutan en paralelo — lanza trabajo en una, observa el streaming de otra
- `PI_WEB_TOKEN` para una exposición segura en la LAN — requerido por defecto para cualquier bind explícito que no sea loopback

### Leer sesiones

- Explora sesiones entre proyectos con filtros, búsqueda y navegación completa de ramas
- Actualizaciones incrementales en vivo mientras pi sigue ejecutándose (vía fsnotify; latencia de ~ms)
- Modo de seguimiento para seguir las sesiones activas
- Enlaces profundos a mensajes individuales
- Descarga una sesión como JSONL
- Comparte instantáneas estáticas como Gists secretos de GitHub
- Extensiones de pi `/web`, `/remote`, `/refresh`, `/pi-web token` y `/pi-web set-token` para abrir sesiones, QR remoto, sincronización de sesiones y gestión de tokens
- `/skill:pi-web-schedule`, `/skill:pi-web-notes`, `/skill:pi-web-settings` (`pi-web-ctl`) para que una sesión pueda gestionar horarios, el bloc de notas del proyecto y la configuración en lenguaje natural

## Requisitos

- [Go](https://go.dev) 1.25+ (solo para compilar desde el código fuente)
- `pi` en tu `PATH` para el chat del navegador/cambio de modelo
- Opcional: `gh` para compartir
- En Windows: pi necesita un shell bash para su herramienta de shell — [Git for Windows](https://git-scm.com/download/win) es suficiente (consulta la documentación de pi para Windows)

## Instalación

### Paquete de pi (recomendado)

```bash
pi install npm:@ygncode/pi-web@beta
```

Este único comando:
- Instala el paquete npm de pi en el directorio de paquetes de pi
- Ejecuta el script `postinstall` del paquete (`install.sh`, o `install.ps1` en Windows)
- Descarga el binario de pi-web correspondiente a tu versión del paquete y plataforma desde GitHub Releases
- Lo instala en `~/.pi/agent/bin/pi-web` (`pi-web.exe` en Windows)
- Configura el auto-inicio al iniciar sesión (launchd en macOS, systemd en Linux, un lanzador de clave Run en Windows)
- Registra los comandos de pi `/web`, `/remote`, `/refresh`, `/pi-web token` y `/pi-web set-token`

La titulación automática de sesiones está integrada en pi-web (no en la extensión) y se configura en la página `/settings`. Está activada por defecto: pi-web nombra las sesiones automáticamente usando una heurística de palabras integrada y gratuita (sin IA), re-titulando con cada mensaje nuevo. Puedes cambiar a titular una vez por sesión, y/o elegir un modelo para escribir títulos más inteligentes en lugar de la heurística.

En Linux, el auto-inicio se configura como un servicio systemd de usuario en `~/.config/systemd/user/pi-web.service`. El instalador reescribe su `ExecStart` a la ruta real del binario instalado. Si Tailscale está disponible en tiempo de ejecución, pi-web publica el servidor localhost con Tailscale Serve HTTPS. Si systemd de usuario no está disponible, ejecútalo manualmente con `~/.pi/agent/bin/pi-web -o`.

Para instalar solo para un proyecto específico (compartido con tu equipo vía `.pi/settings.json`):

```bash
pi install -l npm:@ygncode/pi-web@beta
```

Luego reinicia pi (o ejecuta `/reload`) y usa `/web`, `/pi-web`, `/remote`, `/refresh`. Gestiona tu token de acceso con `/pi-web token` y `/pi-web set-token`.

Si npm aborta con `ENOTEMPTY` al renombrar `@ygncode/pi-web`, elimina los directorios de respaldo ocultos obsoletos de npm y reinstala el canal beta:

```bash
rm -rf ~/.pi/agent/npm/node_modules/@ygncode/.pi-web-*
pi install npm:@ygncode/pi-web@beta
```

### Instalación rápida (sin necesidad de herramientas de compilación)

macOS / Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/ygncode/pi-web/main/install.sh | bash
```

Windows (PowerShell):

```powershell
irm https://raw.githubusercontent.com/ygncode/pi-web/main/install.ps1 | iex
```

Esto descarga el binario más reciente de pi-web, lo instala en `/usr/local/bin` (`~/.pi/agent/bin` en Windows) y configura el auto-inicio al iniciar sesión. No se requiere Go, Node ni pi.

### Descargar el binario

Los binarios precompilados se adjuntan a cada [GitHub Release](https://github.com/ygncode/pi-web/releases).

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

```powershell
# Windows (x64)
irm -OutFile pi-web.exe https://github.com/ygncode/pi-web/releases/latest/download/pi-web-windows-amd64.exe

# Windows (ARM64)
irm -OutFile pi-web.exe https://github.com/ygncode/pi-web/releases/latest/download/pi-web-windows-arm64.exe
```

Luego muévelo a tu PATH:

```bash
cp pi-web ~/.pi/agent/bin/
# o para todo el sistema:
sudo cp pi-web /usr/local/bin/
```

### Compilar desde el código fuente

```bash
git clone https://github.com/ygncode/pi-web.git
cd pi-web
make build   # compila el bundle de Vite y luego lo incrusta en el binario de Go

# opcional: colócalo en el PATH
cp pi-web ~/.pi/agent/bin/
```

El bundle del frontend es incrustado por `web/assets_embed.go`, por lo que `go build` necesita
que `web/dist` exista primero. `make build` realiza ambos pasos en orden; si compilas
a mano, ejecuta `npm --prefix web install && npm --prefix web run build` antes de
`go build ./cmd/pi-web`.

### Desarrollo junto a una instancia instalada

Deja la instancia instalada ejecutándose en el puerto `31415`, luego inicia el
checkout del código fuente en modo de desarrollo:

```bash
make dev
```

Abre `http://127.0.0.1:31416`. `make dev` establece el entorno de desarrollo interno
`PI_WEB_DEV=1`, de modo que el checkout del código fuente comparte sesiones, configuración y
datos SQLite con la instancia instalada, manteniendo un bloqueo de ejecución y un archivo de
estado de desarrollo separados. Las instancias instaladas normales y las lanzadas manualmente
no cambian y conservan el comportamiento original de instancia única.

Para evitar trabajo autónomo duplicado, el modo de desarrollo no ejecuta el
bucle de horarios, el vaciador de la cola de chat, la titulación automática ni las notificaciones push. Las
peticiones directas realizadas a través de la interfaz de desarrollo siguen funcionando. No manejes la misma
sesión de chat desde ambas instancias a la vez; cada proceso tiene su propio gestor de
workers RPC.

`make dev` requiere [Air](https://github.com/air-verse/air) para la recarga en caliente de Go:

```bash
go install github.com/air-verse/air@latest
```

`PI_WEB_DEV` es infraestructura del arnés de desarrollo, no un modo de
multi-instancia de producción soportado.

## Desinstalación

```bash
pi remove npm:@ygncode/pi-web@beta
```

Esto ejecuta el script `preuninstall` del paquete (`uninstall.sh`, o `uninstall.ps1`
en Windows), que detiene la instancia en ejecución y elimina:

- el binario de pi-web (`~/.pi/agent/bin/pi-web`, o `/usr/local/bin/pi-web` para instalaciones independientes)
- el archivo de versión (`~/.pi/agent/pi-web-version`)
- el archivo de estado en tiempo de ejecución (`~/.pi/agent/pi-web/pi-web-state.json`)
- la configuración de auto-inicio (plist de launchd en macOS, servicio systemd de usuario en Linux, entrada de clave Run + scripts de lanzamiento en Windows)

Tus datos se conservan para que una reinstalación posterior retome donde lo dejaste:
`~/.pi/agent/pi-web.sqlite`, `~/.pi/agent/pi-web-memory.sqlite`, tus archivos de sesión
en `~/.pi/agent/sessions/` y `~/.config/pi-web/env` (incluyendo
`PI_WEB_TOKEN`). Elimínalos manualmente si quieres empezar de cero.

## Uso

```bash
# Inicia en el puerto por defecto (31415)
pi-web

# Inicia y abre un navegador
pi-web -o

# Puerto personalizado
pi-web -p 8080

# Sobrescribe el host de bind (loopback no requiere autenticación por defecto)
pi-web --host 127.0.0.1

# El bind que no sea loopback requiere un token — pi-web se niega a iniciar en caso contrario
PI_WEB_TOKEN=$(openssl rand -hex 16) pi-web --host 192.168.1.50
```

Por defecto, pi-web se vincula a `127.0.0.1`. Si Tailscale se está ejecutando con MagicDNS **y `PI_WEB_TOKEN` está configurado**, pi-web también ejecuta `tailscale serve --bg --https=<port> http://127.0.0.1:<port>` e imprime la URL HTTPS de la tailnet. Sin un token, pi-web permanece solo en loopback y omite Tailscale Serve, de modo que los peers de la tailnet no pueden alcanzar el agente sin autenticación. Cualquier bind explícito que no sea loopback también requiere que `PI_WEB_TOKEN` esté configurado; pasa `--insecure` para sobrescribirlo en pruebas locales.

## Acceso remoto

Deja pi-web escuchando localmente y luego usa la URL HTTPS de Tailscale impresa desde tu teléfono o portátil en la tailnet.

En macOS, instala y abre Tailscale de forma interactiva, aprueba el aviso del administrador e inicia sesión. Luego ejecuta `/pi-web restart`, seguido de `/remote`.

En Linux, permite a tu usuario gestionar Tailscale antes de instalar/ejecutar pi-web; de lo contrario, `tailscale serve` puede requerir sudo y el auto-inicio puede fallar:

```bash
sudo tailscale set --operator=$USER
```

```bash
# 1. Inicia pi-web con un token para que publique el endpoint HTTPS de Tailscale
PI_WEB_TOKEN=$(openssl rand -hex 16) pi-web

# 2. Desde cualquier otro dispositivo conectado a Tailscale, abre la
#    URL "Tailscale HTTPS" impresa e introduce el token una vez.
```

> Por defecto, pi-web se niega a vincularse a una dirección que no sea loopback a menos que `PI_WEB_TOKEN` esté configurado — cualquier persona que pueda alcanzar la dirección vinculada podría, de lo contrario, ver sesiones y enviar instrucciones a pi. Para sobrescribir esta protección en pruebas de red local, pasa `--insecure`. **No uses `--insecure` en Tailscale ni en ninguna dirección accesible desde fuera de tu máquina.**
>
> Los clientes pueden pasar el token mediante la cabecera `Authorization: Bearer <token>`, la cabecera `X-Pi-Token`, o una vez vía `?token=<token>` (o el aviso de inicio de sesión). Cuando el token llega a través de la cadena de consulta, pi-web establece una cookie `pi_token` y redirige a la misma URL con el token eliminado, de modo que no permanece en la barra de direcciones ni en el historial del navegador. Prefiere la forma de cabecera para scripts y automatización.

## Chat del navegador

Abre una página de sesión y usa el compositor en la parte inferior para continuar esa sesión exacta.

- `Enter` envía, `Shift+Enter` inserta un salto de línea
- Arrastra y suelta o pega imágenes directamente en el compositor
- El selector de modelo y el selector de nivel de pensamiento están en la cabecera — los cambios se aplican al worker de pi subyacente inmediatamente
- Cada sesión activa obtiene su propio worker dedicado `pi --mode rpc`, de modo que las diferentes sesiones no se bloquean entre sí

## Compartir sesiones

Haz clic en **Compartir** en una página de sesión para crear un Gist secreto de GitHub.

Requisitos:
- `gh` instalado
- `gh auth login` completado

Compartir devuelve:
- la URL del gist secreto
- una URL de vista previa en `https://pi.dev/session/#<gistId>`

Los gists compartidos son instantáneas y no se actualizan en vivo.

## Auto-inicio al iniciar sesión

### macOS

```bash
cp init/com.pi-web.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.pi-web.plist
```

### Linux (systemd)

```bash
# Instala el servicio systemd de usuario
mkdir -p ~/.config/systemd/user
cp init/pi-web.service ~/.config/systemd/user/

# Opcional: configura tu PI_WEB_TOKEN para binds que no sean loopback
# (o usa /pi-web set-token <token> desde dentro de pi)
mkdir -p ~/.config/pi-web
echo 'PI_WEB_TOKEN=your-token-here' > ~/.config/pi-web/env

# Habilita e inicia
systemctl --user daemon-reload
systemctl --user enable --now pi-web.service

# Comprueba el estado
systemctl --user status pi-web.service

# Ver los registros
journalctl --user -u pi-web.service -f
```

> Para que el servicio se inicie en el arranque (antes del inicio de sesión), usa un servicio de sistema en su lugar:
> copia `init/pi-web.service` a `/etc/systemd/system/` y usa `sudo systemctl`.

### Windows

El instalador configura esto automáticamente, sin necesidad de derechos de administrador: una
entrada `pi-web` en `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`
lanza `~/.config/pi-web/pi-web-start.vbs` al iniciar sesión, lo que inicia el binario
oculto (sin ventana de consola) después de cargar `~/.config/pi-web/env`
(`PI_WEB_TOKEN`, `PATH`, ...).

Para gestionarlo manualmente:

```powershell
# Iniciar / detener
wscript.exe "$HOME\.config\pi-web\pi-web-start.vbs"
taskkill /IM pi-web.exe /F

# Eliminar el auto-inicio
Remove-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'pi-web'
```

No hay supervisión del servicio en Windows: si pi-web falla, permanece detenido
hasta el siguiente inicio de sesión (launchd/systemd lo reinician automáticamente en las otras
plataformas).
