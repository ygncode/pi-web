ユーザーが pi-web を以下の方法でインストールしています：

- pi install npm:@ygncode/pi-web@beta

これは自動的に [install.sh](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/install.sh) を実行し、pi をセットアップします。

ユーザーが問題を抱えている場合、install.sh のセットアップが原因である可能性があります。状況を確認し、何が問題を引き起こしているのかをユーザーに正確に伝えてください。そして修正が必要かどうかを尋ねてください。必ずユーザーに確認してください。

ユーザーがモバイルや他のネットワークから pi にアクセスできるようにするには、tailscale を使用して tailscale ネットワーク経由でアクセスする方法が推奨されます。また、ユーザーは tailscale ダッシュボード（https://login.tailscale.com/admin/dns）で HTTPs を有効にする必要があります。

tailscale がインストールされていない場合、または tailscale を使用したくない場合は、`pi-web status` を実行してバイナリパス、バイナリのステータス、およびアプリケーションにアクセスできるローカルエンドポイントを取得できます。ただし、HTTP であるためプッシュ通知は受け取れないことに注意してください。

mac では [com.pi-web.plist](https://raw.githubusercontent.com/ygncode/pi-web/refs/heads/main/init/com.pi-web.plist) がセットアップされます。
linux では [pi-web.service](https://github.com/ygncode/pi-web/blob/main/init/pi-web.service) がセットアップされます。

さらにデバッグして状況を確認する必要がある場合は、こちらを参照してください。
