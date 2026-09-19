# インストールと使用方法

## 機能

### リモート操作

- ブラウザからテキストまたは画像添付付きで任意のセッションを継続できます
- Web UIから直接、任意のプロジェクトパスに対して新しいセッションを開始できます
- セッションごとに、ブラウザ内でモデル切り替えと思考レベルセレクターが使えます
- セッションごとのワーカーステータス（idle / running / error）と、クラッシュ時の自動復旧
- 複数のセッションを並列実行 — 1つで作業を開始し、別のセッションのストリームを監視できます
- 安全なLAN公開のための `PI_WEB_TOKEN` — 明示的な非ループバックバインドではデフォルトで必須

### セッションの閲覧

- フィルター、検索、完全なブランチナビゲーションでプロジェクトをまたいでセッションを閲覧できます
- piの実行中もライブで増分更新（fsnotify経由、約ミリ秒の遅延）
- アクティブなセッションを追尾するフォローモード
- 個々のメッセージへのディープリンク
- セッションをJSONLとしてダウンロード
- 静的スナップショットをシークレットGitHub Gistとして共有
- セッションのオープン、リモートQR、セッション同期、トークン管理のための `/web`、`/remote`、`/refresh`、`/pi-web token`、`/pi-web set-token` pi拡張機能
- セッションがスケジュール、プロジェクトのスクラッチパッド、設定を自然言語で管理できるようにする `/skill:pi-web-schedule`、`/skill:pi-web-notes`、`/skill:pi-web-settings`（`pi-web-ctl`）

## 要件

- [Go](https://go.dev) 1.25+（ソースからのビルドのみに必要）
- ブラウザチャット/モデル切り替えには `pi` が `PATH` 上にある必要があります
- オプション: 共有には `gh`
- Windowsの場合: piのシェルツールにはbashシェルが必要です — [Git for Windows](https://git-scm.com/download/win) で十分です（piのWindowsドキュメントを参照）

## インストール

### Piパッケージ（推奨）

```bash
pi install npm:@ygncode/pi-web@beta
```

この1つのコマンドで:

- npm piパッケージをpiのパッケージディレクトリ配下にインストールします
- パッケージの `postinstall` スクリプトを実行します（`install.sh`、Windowsでは `install.ps1`）
- パッケージのバージョンとプラットフォームに一致するpi-webバイナリをGitHub Releasesからダウンロードします
- `~/.pi/agent/bin/pi-web`（Windowsでは `pi-web.exe`）にインストールします
- ログイン時の自動起動を設定します（macOSではlaunchd、Linuxではsystemd、WindowsではRunキーのランチャー）
- `/web`、`/remote`、`/refresh`、`/pi-web token`、`/pi-web set-token` のpiコマンドを登録します

セッションの自動タイトル付けはpi-webに組み込まれており（拡張機能ではありません）、`/settings` ページで設定します。デフォルトで有効です。pi-webは無料の組み込み単語ヒューリスティック（AIなし）を使ってセッションに自動的に名前を付け、新しいメッセージごとにタイトルを付け直します。セッションごとに1回だけタイトルを付けるように切り替えたり、ヒューリスティックの代わりにより賢いタイトルを書くモデルを選択したりできます。

Linuxでは、自動起動は `~/.config/systemd/user/pi-web.service` のユーザーsystemdサービスとして設定されます。インストーラーはその `ExecStart` を実際にインストールされたバイナリパスに書き換えます。実行時にTailscaleが利用可能な場合、pi-webはTailscale Serve HTTPSでlocalhostサーバーを公開します。ユーザーsystemdが利用できない場合は、`~/.pi/agent/bin/pi-web -o` で手動実行してください。

特定のプロジェクトにのみインストールする場合（`.pi/settings.json` 経由でチームと共有）:

```bash
pi install -l npm:@ygncode/pi-web@beta
```

その後、piを再起動し（または `/reload` を実行）、`/web`、`/pi-web`、`/remote`、`/refresh` を使用します。アクセストークンは `/pi-web token` と `/pi-web set-token` で管理します。

`@ygncode/pi-web` のリネーム中にnpmが `ENOTEMPTY` で中断した場合は、npmの古い隠しバックアップディレクトリを削除して、betaチャネルを再インストールしてください:

```bash
rm -rf ~/.pi/agent/npm/node_modules/@ygncode/.pi-web-*
pi install npm:@ygncode/pi-web@beta
```

### クイックインストール（ビルドツール不要）

macOS / Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/ygncode/pi-web/main/install.sh | bash
```

Windows (PowerShell):

```powershell
irm https://raw.githubusercontent.com/ygncode/pi-web/main/install.ps1 | iex
```

これは最新のpi-webバイナリをダウンロードし、`/usr/local/bin`（Windowsでは `~/.pi/agent/bin`）にインストールし、ログイン時の自動起動を設定します。Go、Node、piは不要です。

### バイナリのダウンロード

ビルド済みバイナリは各 [GitHub Release](https://github.com/ygncode/pi-web/releases) に添付されています。

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

その後、PATHに移動します:

```bash
cp pi-web ~/.pi/agent/bin/
# or system-wide:
sudo cp pi-web /usr/local/bin/
```

### ソースからのビルド

```bash
git clone https://github.com/ygncode/pi-web.git
cd pi-web
make build   # builds the Vite bundle, then embeds it into the Go binary

# optional: put it on PATH
cp pi-web ~/.pi/agent/bin/
```

フロントエンドバンドルは `web/assets_embed.go` によって埋め込まれるため、`go build` にはまず `web/dist` が存在する必要があります。`make build` は両方の手順を順番に実行します。手動でビルドする場合は、`go build ./cmd/pi-web` の前に `npm --prefix web install && npm --prefix web run build` を実行してください。

### インストール済みインスタンスと並行した開発

インストール済みインスタンスをポート `31415` で実行したままにして、ソースチェックアウトを開発モードで起動します:

```bash
make dev
```

`http://127.0.0.1:31416` を開きます。`make dev` は内部の `PI_WEB_DEV=1` 開発環境を設定するため、ソースチェックアウトはインストール済みインスタンスとセッション、設定、SQLiteデータを共有しつつ、別の開発用ランタイムロックとステートファイルを保持します。通常のインストール済みおよび手動起動インスタンスは変更されず、元の単一インスタンス動作を維持します。

自律的な作業の重複を防ぐため、開発モードではスケジュールループ、チャットキューのドレイナー、自動タイトル付け、プッシュ通知は実行されません。開発UIを通じた直接のリクエストは引き続き機能します。同じチャットセッションを両方のインスタンスから同時に操作しないでください。各プロセスには独自のRPCワーカーマネージャーがあります。

`make dev` にはGoのホットリロードに [Air](https://github.com/air-verse/air) が必要です:

```bash
go install github.com/air-verse/air@latest
```

`PI_WEB_DEV` は開発ハーネスのための内部機構であり、サポート対象の本番用マルチインスタンスモードではありません。

## アンインストール

```bash
pi remove npm:@ygncode/pi-web@beta
```

これはパッケージの `preuninstall` スクリプト（`uninstall.sh`、Windowsでは `uninstall.ps1`）を実行し、実行中のインスタンスを停止して以下を削除します:

- pi-webバイナリ（`~/.pi/agent/bin/pi-web`、スタンドアロンインストールの場合は `/usr/local/bin/pi-web`）
- バージョンファイル（`~/.pi/agent/pi-web-version`）
- ランタイムステートファイル（`~/.pi/agent/pi-web/pi-web-state.json`）
- 自動起動設定（macOSではlaunchd plist、Linuxではsystemdユーザーサービス、WindowsではRunキーのエントリ＋ランチャースクリプト）

データは保持されるため、後で再インストールすれば中断したところから再開できます。`~/.pi/agent/pi-web.sqlite`、`~/.pi/agent/pi-web-memory.sqlite`、`~/.pi/agent/sessions/` 配下のセッションファイル、`~/.config/pi-web/env`（`PI_WEB_TOKEN` を含む）です。白紙の状態にしたい場合は、これらを手動で削除してください。

## 使用方法

```bash
# Start on the default port (31415)
pi-web

# Start and open a browser
pi-web -o

# Custom port
pi-web -p 8080

# Override bind host (loopback is unauthenticated by default)
pi-web --host 127.0.0.1

# Non-loopback bind requires a token — pi-web refuses to start otherwise
PI_WEB_TOKEN=$(openssl rand -hex 16) pi-web --host 192.168.1.50
```

デフォルトでは、pi-webは `127.0.0.1` にバインドします。TailscaleがMagicDNSで実行中 **かつ `PI_WEB_TOKEN` が設定されている** 場合、pi-webは `tailscale serve --bg --https=<port> http://127.0.0.1:<port>` も実行し、HTTPSのtailnet URLを表示します。トークンがない場合、pi-webはループバックのみのままでTailscale Serveをスキップするため、tailnetのピアは認証なしにエージェントへ到達できません。明示的な非ループバックバインドも `PI_WEB_TOKEN` の設定を必要とします。ローカルテスト用に上書きするには `--insecure` を渡します。

## リモートアクセス

pi-webをローカルでリッスンしたままにして、tailnet上のスマートフォンまたはラップトップから表示されたTailscale HTTPS URLを使用します。

macOSでは、Tailscaleを対話的にインストールして開き、管理者プロンプトを承認してサインインします。その後 `/pi-web restart` を実行し、続けて `/remote` を実行します。

Linuxでは、pi-webのインストール/実行前にユーザーがTailscaleを管理できるようにしてください。そうしないと `tailscale serve` がsudoを必要とし、自動起動が失敗する可能性があります:

```bash
sudo tailscale set --operator=$USER
```

```bash
# 1. Start pi-web with a token so it publishes the Tailscale HTTPS endpoint
PI_WEB_TOKEN=$(openssl rand -hex 16) pi-web

# 2. From any other Tailscale-connected device, open the printed
#    "Tailscale HTTPS" URL and enter the token once.
```

> デフォルトでは、`PI_WEB_TOKEN` が設定されていない限り、pi-webは非ループバックアドレスへのバインドを拒否します。そうしないと、バインドされたアドレスに到達できる誰もがセッションを閲覧し、piに指示を送ることができてしまうためです。ローカルネットワークのテスト用にこのガードを上書きするには、`--insecure` を渡します。**Tailscaleやマシン外部から到達可能なアドレスでは `--insecure` を使用しないでください。**
>
> クライアントはトークンを `Authorization: Bearer <token>` ヘッダー、`X-Pi-Token` ヘッダー、または一度だけ `?token=<token>`（またはログインプロンプト）経由で渡せます。トークンがクエリ文字列経由で届いた場合、pi-webは `pi_token` クッキーを設定し、トークンを除去した同じURLへリダイレクトするため、アドレスバーやブラウザ履歴に残りません。スクリプトや自動化ではヘッダー形式を優先してください。

## ブラウザチャット

セッションページを開き、下部のコンポーザーを使ってそのセッションを正確に継続します。

- `Enter` で送信、`Shift+Enter` で改行を挿入
- 画像をコンポーザーに直接ドラッグ＆ドロップまたは貼り付けできます
- モデルピッカーと思考レベルセレクターはヘッダーにあり、変更は基盤のpiワーカーに即座に適用されます
- 各アクティブセッションには専用の `pi --mode rpc` ワーカーが割り当てられるため、異なるセッションが互いにブロックすることはありません

## セッションの共有

セッションページで **共有** をクリックすると、シークレットGitHub Gistを作成できます。

要件:

- `gh` がインストールされていること
- `gh auth login` が完了していること

共有すると以下が返されます:

- シークレットgistのURL
- `https://pi.dev/session/#<gistId>` のプレビューURL

共有されたgistはスナップショットであり、ライブ更新はされません。

## ログイン時の自動起動

### macOS

```bash
cp init/com.pi-web.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.pi-web.plist
```

### Linux (systemd)

```bash
# Install the systemd user service
mkdir -p ~/.config/systemd/user
cp init/pi-web.service ~/.config/systemd/user/

# Optional: set your PI_WEB_TOKEN for non-loopback binds
# (or use /pi-web set-token <token> from inside pi)
mkdir -p ~/.config/pi-web
echo 'PI_WEB_TOKEN=your-token-here' > ~/.config/pi-web/env

# Enable and start
systemctl --user daemon-reload
systemctl --user enable --now pi-web.service

# Check status
systemctl --user status pi-web.service

# View logs
journalctl --user -u pi-web.service -f
```

> ブート時（ログイン前）にサービスを起動するには、代わりにシステムサービスを使用します。`init/pi-web.service` を `/etc/systemd/system/` にコピーし、`sudo systemctl` を使用してください。

### Windows

インストーラーは管理者権限なしでこれを自動的に設定します。`HKCU\Software\Microsoft\Windows\CurrentVersion\Run` 配下の `pi-web` エントリが、ログイン時に `~/.config/pi-web/pi-web-start.vbs` を起動し、`~/.config/pi-web/env`（`PI_WEB_TOKEN`、`PATH`、...）を読み込んだ後にバイナリを非表示（コンソールウィンドウなし）で開始します。

手動で管理するには:

```powershell
# Start / stop
wscript.exe "$HOME\.config\pi-web\pi-web-start.vbs"
taskkill /IM pi-web.exe /F

# Remove auto-start
Remove-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'pi-web'
```

Windowsではサービスの監視はありません。pi-webがクラッシュすると、次回ログインまで停止したままになります（他のプラットフォームではlaunchd/systemdが自動的に再起動します）。
