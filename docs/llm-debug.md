User is installing pi-web via 

- pi install npm:@ygncode/pi-web@beta

Which it automatically run [install.sh](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/install.sh) and setup pi.

If user is having issue it might be the setup of install.sh is causing issue. You can review and check what's going on and provide user what exactly is causing problem. And ask if they want you to fix. Always confirm with user.

In order for user to be able to access the pi in their mobile or other network. The recommended way is to use tailscale and access it form tailscale network. And user will have to enable the HTTPs in their tailscale dashboard - https://login.tailscale.com/admin/dns

If they don't have tailscale install or don't want to use tailscale. They can run `pi-web status` and get the binary path, status of the binary and the local endpoint which they can access the application. But to note, they won't be able to get the push notification as it's in http.

In mac it's setup [com.pi-web.plist](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/init/com.pi-web.plist)
In linux it setup [pi-web.service](https://github.com/ygncode/pi-web/blob/main/init/pi-web.service)

In case if you need to debug futher and see what's going on.
