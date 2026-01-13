# Home Screen (Dashboard)

## English

Hi! This folder is the **Home Screen** of my small web app project.
It shows a quick dashboard and lets you move to other pages like Messaging and Connection.

### How to open (recommended)
Because the Connection page uses `fetch()` for `ping.json`, it works best with a local server.

1. Open a terminal in the project folder
2. Run:
   - `python -m http.server 8000`
3. Open in your browser:
   - `http://localhost:8000/home%20screen/index.html`

### What you can do
- See basic cards on the dashboard
- Open **Messaging** (goes to the SMS page)
- See **Latency Trend** graph preview
  - This graph shows the last Connection test result (saved in `localStorage`)

### Latency Trend (important)
- The Home Screen reads saved data from `localStorage` key: `networkTestStats`
- If you run a Connection test first, then come back here, the mini graph should appear

### Files
- `index.html` : page layout
- `style.css` : theme and layout (same style as other pages)
- `script.js` : interactions + the mini latency graph drawing

### Small notes
- If the graph is empty, please run a Connection test first.
- If you don’t use a local server, the Connection test may fail because browsers block some requests on `file://`.

---

## 日本語 (Japanese)

こんにちは！このフォルダは、このWebアプリの **ホーム画面** です。
ダッシュボードを表示して、Messaging（SMS）や Connection（接続テスト）などのページに移動できます。

### 開き方（おすすめ）
Connectionページでは `ping.json` を `fetch()` で読み込むので、ローカルサーバーで開くのが安心です。

1. プロジェクトフォルダでターミナルを開く
2. これを実行：
   - `python -m http.server 8000`
3. ブラウザで開く：
   - `http://localhost:8000/home%20screen/index.html`

### できること
- ダッシュボードのカードを確認する
- **Messaging** を開く（SMSページへ移動）
- **Latency Trend** のミニグラフを見る
  - Connectionテストの最新結果を `localStorage` から読み込みます

### Latency Trend（大事）
- ホーム画面は `localStorage` の `networkTestStats` を読み込みます
- 先に Connection テストを動かしてから戻ると、ミニグラフが表示されます

### ファイル
- `index.html`：画面のHTML
- `style.css`：テーマとレイアウト（他ページと同じ雰囲気）
- `script.js`：動き + ミニグラフの描画

### メモ
- グラフが空なら、Connectionテストを先に実行してください。
- `file://` で開くとブラウザの制限でテストが失敗する場合があります。
