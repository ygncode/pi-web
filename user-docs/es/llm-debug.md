El usuario está instalando pi-web mediante

- pi install npm:@ygncode/pi-web@beta

Lo cual ejecuta automáticamente [install.sh](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/install.sh) y configura pi.

Si el usuario tiene un problema, podría ser que la configuración de install.sh esté causando el problema. Puedes revisar y comprobar qué está pasando e indicar al usuario exactamente qué está causando el problema. Y pregúntale si quiere que lo arregles. Confirma siempre con el usuario.

Para que el usuario pueda acceder a pi desde su móvil u otra red, la forma recomendada es usar tailscale y acceder desde la red de tailscale. Y el usuario tendrá que habilitar HTTPS en su panel de tailscale - https://login.tailscale.com/admin/dns

Si no tienen tailscale instalado o no quieren usar tailscale, pueden ejecutar `/pi-web status` desde dentro de pi y obtener la ruta del binario, el estado del binario y el endpoint local desde el que pueden acceder a la aplicación. (`/pi-web path` imprime solo la ruta del binario.) Pero ten en cuenta que no podrán recibir las notificaciones push porque está en http.

En mac se configura [com.pi-web.plist](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/init/com.pi-web.plist)
En linux se configura [pi-web.service](https://github.com/ygncode/pi-web/blob/main/init/pi-web.service)

En caso de que necesites depurar más a fondo y ver qué está pasando.
