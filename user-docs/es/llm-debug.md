El usuario está instalando pi-web mediante

- `pi install npm:@ygncode/pi-web@beta`

El cual ejecuta automáticamente [install.sh](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/install.sh) y configura pi.

Si el usuario tiene problemas, podría ser que la configuración de install.sh esté causando el problema. Puedes revisar y verificar qué está ocurriendo y proporcionar al usuario qué está causando exactamente el problema. Y preguntar si quieren que lo arregles. Siempre confirma con el usuario.

Para que el usuario pueda acceder a pi en su móvil u otra red, la forma recomendada es usar Tailscale y acceder desde la red de Tailscale. Y el usuario tendrá que habilitar HTTPS en su panel de Tailscale - https://login.tailscale.com/admin/dns

Si no tienen Tailscale instalado o no quieren usar Tailscale, pueden ejecutar `pi-web status` y obtener la ruta del binario, el estado del binario y el endpoint local desde el cual pueden acceder a la aplicación. Pero ten en cuenta que no podrán recibir notificaciones push ya que está en HTTP.

En macOS se configura [com.pi-web.plist](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/init/com.pi-web.plist)
En Linux se configura [pi-web.service](https://github.com/ygncode/pi-web/blob/main/init/pi-web.service)

En caso de que necesites depurar más a fondo y ver qué está ocurriendo.
