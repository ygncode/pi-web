# インストールと使い方

## 機能

### リモート操作

- ブラウザからテキストや画像添付で任意のセッションを継続
- 任意のプロジェクトパスに対して新しいセッションをWeb UIから直接開始
- ブラウザ内でのモデル切り替えと思考レベル選択（セッションごと）
- セッションごとのワーカーステータス（idle / running / error）とクラッシュ時の自動復旧
- 複数セッションを並列実行 — ある作業を開始しつつ、別のストリームを監視
- `PI_WEB_TOKEN` による安全なLAN公開 — 明示的な非ループバックバインドではデフォルトで必須

### セッションの閲覧

- プロジェクトをまたいだセッションの閲覧（フィルター、検索、ブランチナビゲーション付き）
- piの実行中もライブな差分更新（fsnotify経由、〜ミリ秒のレイテンシ）
- アクティブセッションを追跡するフォローモード
- 個別メッセージへのディープリンク
- セッションをJSONLとしてダウンロード
- 静的スナップショットをシークレットGitHub Gistとして共有
- セッションを開く・リモートQR・セッション同期・トークン管理のための `/web`、`/remote`、`/refresh`、`/pi-web token`、`/pi-web set-token` pi拡張

## 要件

- [Go](https://go.dev) 1.25+
- ブラウザチャット/モデル切り替えのために `pi` が `PATH` 上に存在すること
- オプション: 共有用に `gh`

## インストール

### Piパッケージ（推奨）

```bash
pi install npm:@ygncode/pi-web@beta
```

この単一コマンドで以下を実行します:
- piのパッケージディレクトリにnpm piパッケージをインストール
- パッケージの `postinstall` スクリプト（`bash install.sh`）を実行
- パッケージバージョンとプラットフォームに対応するpi-webバイナリをGitHub Releasesからダウンロード
- `~/.pi/agent/bin/pi-web` にインストール
- ログイン時の自動起動を設定（macOSではlaunchd、Linuxではsystemd）
- `/web`、`/remote`、`/refresh`、`/pi-web token`、`/pi-web set-token` piコマンドを登録

セッション自動タイトル付けはpi-webに組み込まれており（拡張機能ではありません）、`/settings` ページで設定します。デフォルトでオンです: pi-webは無料の組み込み単語ヒューリスティック（AI不使用）を使ってセッションに自動で名前を付け、新しいメッセージごとに再タイトル付けします。セッションごとに1回だけのタイトル付けに切り替えたり、ヒューリスティックの代わりにより賢いタイトルを生成するモデルを選択したりすることもできます。

Linuxでは、自動起動はユーザーsystemdサービスとして `~/.config/systemd/user/pi-web.service` に設定されます。インストーラーはその `ExecStart` を実際のインストール済みバイナリパスに書き換えます。実行時にTailscaleが利用可能な場合、pi-webはローカルホストサーバーをTailscale Serve HTTPSで公開します。ユーザーsystemdが利用できない場合は、`~/.pi/agent/bin/pi-web -o` で手動実行してください。

特定のプロジェクトのみにインストールする場合（`.pi/settings.json` 経由でチームと共有）:

```bash
pi install -l npm:@ygncode/pi-web@beta
```

その後piを再起動（または `/reload` を実行）し、`/web`、`/pi-web`、`/remote`、`/refresh` を使用します。アクセストークンは `/pi-web token` と `/pi-web set-token` で管理します。

npmが `@ygncode/pi-web` のリネーム中に `ENOTEMPTY` で中断した場合は、npmの古い隠しバックアップディレクトリを削除してbetaチャンネルを再インストールしてください:

```bash
rm -rf ~/.pi/agent/npm/node_modules/@ygncode/.pi-web-*
pi install npm:@ygncode/pi-web@beta
```

### クイックインストール（ビルドツール不要）

```bash
curl -fsSL https://raw.githubusercontent.com/ygncode/pi-web/main/install.sh | bash
```

最新のpi-webバイナリをダウンロードし、`/usr/local/bin` にインストールして、ログイン時の自動起動を設定します。Go、Node、piは不要です。

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

その後、PATH上に移動します:

```bash
cp pi-web ~/.pi/agent/bin/
# またはシステム全体:
sudo cp pi-web /usr/local/bin/
```

### ソースからビルド

```bash
git clone https://github.com/ygncode/pi-web.git
cd pi-web
make build   # Viteバンドルをビルドし、Goバイナリに埋め込みます

# オプション: PATHに追加
cp pi-web ~/.pi/agent/bin/
```

フロントエンドバンドルは `web/assets_embed.go` によって埋め込まれるため、`go build` には
事前に `web/dist` が存在している必要があります。`make build` は両方のステップを順に実行します。
手動でビルドする場合は、`go build ./cmd/pi-web` の前に
`npm --prefix web install && npm --prefix web run build` を実行してください。

## アンインストール

```bash
pi remove npm:@ygncode/pi-web@beta
```

これはパッケージの `preuninstall` スクリプト（`bash uninstall.sh`）を実行し、
実行中のインスタンスを停止して以下を削除します:

- pi-webバイナリ（`~/.pi/agent/bin/pi-web`、またはスタンドアロンインストールの場合は `/usr/local/bin/pi-web`）
- バージョンファイル（`~/.pi/agent/pi-web-version`）
- ランタイム状態ファイル（`~/.pi/agent/pi-web/pi-web-state.json`）
- 自動起動設定（macOSではlaunchd plist、Linuxではsystemdユーザーサービス）

データは保持されるため、後で再インストールすれば中断したところから再開できます:
`~/.pi/agent/pi-web.sqlite`、`~/.pi/agent/pi-web-memory.sqlite`、
`~/.pi/agent/sessions/` 以下のセッションファイル、および `~/.config/pi-web/env`
（`PI_WEB_TOKEN` を含む）。クリーンな状態にしたい場合はこれらを手動で削除してください。

## 使い方

```bash
# デフォルトポート（31415）で起動
pi-web

# 起動してブラウザを開く
pi-web -o

# カスタムポート
pi-web -p 8080

# バインドホストを上書き（ループバックはデフォルトで認証不要）
pi-web --host 127.0.0.1

# 非ループバックバインドにはトークンが必要 — さもなければpi-webは起動を拒否します
PI_WEB_TOKEN=$(openssl rand -hex 16) pi-web --host 192.168.1.50
```

デフォルトでは、pi-webは `127.0.0.1` にバインドします。TailscaleがMagicDNS付きで実行中の場合、pi-webは `tailscale serve --bg --https=<port> http://127.0.0.1:<port>` も実行し、HTTPS tailnet URLを表示します。明示的な非ループバックバインドには `PI_WEB_TOKEN` の設定が必要です。ローカルテスト用に上書きするには `--insecure` を渡してください。

## リモートアクセス

pi-webをローカルで待ち受けさせたまま、表示されたTailscale HTTPS URLをtailnet上のスマートフォンやノートパソコンから使用します。

macOS では、Tailscale を対話形式でインストールして開き、管理者プロンプトを承認してサインインします。その後、`/pi-web restart` を実行し、続けて `/remote` を実行します。

Linuxでは、pi-webをインストール/実行する前に、ユーザーがTailscaleを管理できるようにしてください。さもなければ `tailscale serve` にsudoが必要になり、自動起動が失敗する可能性があります:

```bash
sudo tailscale set --operator=$USER
```

```bash
# 1. pi-webを起動
pi-web

# 2. Tailscale接続された任意のデバイスから、表示された
#    "Tailscale HTTPS" URLを開きます。
```

> デフォルトでは、pi-webは `PI_WEB_TOKEN` が設定されていない限り非ループバックアドレスへのバインドを拒否します — バインドされたアドレスに到達できる誰もがセッションを閲覧し、piに指示を送信できてしまうためです。ローカルネットワークテスト用にこのガードを上書きするには `--insecure` を渡してください。**Tailscaleやマシン外部から到達可能なアドレスでは `--insecure` を使用しないでください。**
>
> クライアントは `Authorization: Bearer <token>` ヘッダー、`X-Pi-Token` ヘッダー、または初回のみ `?token=<token>`（後続リクエスト用に `pi_token` クッキーを設定）でトークンを渡せます。`?token=` で渡されたトークンはブラウザ履歴、サーバーアクセスログ、ページ上のリンクからの `Referer` ヘッダーに残ります — 初回ブックマーク以降はヘッダー形式を推奨します。

## ブラウザチャット

セッションページを開き、下部のコンポーザーを使ってそのセッションを正確に継続します。

- `Enter` で送信、`Shift+Enter` で改行を挿入
- 画像をコンポーザーに直接ドラッグ＆ドロップまたはペースト
- モデルピッカーと思考レベルセレクターはヘッダーにあり — 変更は基盤のpiワーカーに即座に適用されます
- 各アクティブセッションには専用の `pi --mode rpc` ワーカーが割り当てられるため、異なるセッションが互いをブロックしません

## セッションの共有

セッションページで **共有** をクリックすると、シークレットGitHub Gistを作成します。

要件:
- `gh` がインストールされていること
- `gh auth login` が完了していること

共有の結果:
- シークレットgist URL
- `https://pi.dev/session/#<gistId>` のプレビューURL

共有されたgistはスナップショットであり、ライブ更新はされません。

## ログイン時の自動起動

### macOS

```bash
cp init/com.pi-web.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.pi-web.plist
```

### Linux（systemd）

```bash
# systemdユーザーサービスをインストール
mkdir -p ~/.config/systemd/user
cp init/pi-web.service ~/.config/systemd/user/

# オプション: 非ループバックバインド用にPI_WEB_TOKENを設定
# （またはpi内から /pi-web set-token <token> を使用）
mkdir -p ~/.config/pi-web
echo 'PI_WEB_TOKEN=your-token-here' > ~/.config/pi-web/env

# 有効化して起動
systemctl --user daemon-reload
systemctl --user enable --now pi-web.service

# ステータス確認
systemctl --user status pi-web.service

# ログの表示
journalctl --user -u pi-web.service -f
```

> ブート時（ログイン前）にサービスを開始するには、代わりにシステムサービスを使用してください:
> `init/pi-web.service` を `/etc/systemd/system/` にコピーし、`sudo systemctl` を使用します。
