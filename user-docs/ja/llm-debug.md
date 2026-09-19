ユーザーは pi-web を次の方法でインストールしています:

- `pi install npm:@ygncode/pi-web@beta`

これにより [install.sh](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/install.sh) が自動的に実行され、pi がセットアップされます。

ユーザーが問題を抱えている場合、install.sh のセットアップが原因である可能性があります。何が起きているかを確認し、問題の正確な原因をユーザーに伝えることができます。そして修正を希望するかどうかを尋ねてください。必ずユーザーに確認してください。

ユーザーがモバイルや他のネットワークから pi にアクセスできるようにするには、推奨される方法は Tailscale を使用し、Tailscale ネットワークからアクセスすることです。また、ユーザーは Tailscale ダッシュボードで HTTPS を有効にする必要があります - https://login.tailscale.com/admin/dns

Tailscale がインストールされていない、または Tailscale を使いたくない場合は、pi の中で `/pi-web status` を実行すると、バイナリのパス、バイナリのステータス、アプリケーションにアクセスできるローカルエンドポイントを取得できます。(`/pi-web path` はバイナリのパスだけを表示します。) ただし、http のためプッシュ通知を受け取ることはできない点に注意してください。

mac では [com.pi-web.plist](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/init/com.pi-web.plist) がセットアップされます。
Linux では [pi-web.service](https://github.com/ygncode/pi-web/blob/main/init/pi-web.service) がセットアップされます。

さらにデバッグして何が起きているかを確認する必要がある場合。
