# Connection (Simulation)

## English

Hi! This folder is the **Connection / Simulation** page of my project.
It runs a simple latency test by sending requests to `ping.json` many times and drawing a graph.

### How to open (recommended)
Please use a local server so `fetch()` works correctly.

1. Open a terminal in the project folder
2. Run:
   - `python -m http.server 8000`
3. Open in your browser:
   - `http://localhost:8000/simulation/index.html`

### How the test works (simple)
- When you click **Start Test**, it repeatedly requests `./ping.json`
- It measures the time and treats it like “latency” (ms)
- It draws a line graph on the canvas

### Data saving (important)
- The test data is saved in `localStorage` under this key:
  - `networkTestStats`
- The data stays even if you:
  - refresh the page
  - move to another page
- The saved data will be replaced when you start a **new** test

### Buttons
- **Start Test**: clears old points and starts measuring
- **Stop**: stops measuring (data is still kept)

### Files
- `index.html` : UI layout (cards + graph)
- `style.css` : theme and layout
- `script.js` : ping loop, graph drawing, and saving to `localStorage`
- `ping.json` : small local file used for the test request

### Troubleshooting
- If you see an error like “run via a local server”, it usually means you opened `index.html` with `file://`.
- Start the local server (steps above) and open `http://localhost:8000/...`.

---

## 日本語 (Japanese)

こんにちは！このフォルダは、プロジェクトの **Connection（接続テスト）/ Simulation** ページです。
`ping.json` に何回もリクエストを送って、時間を測って、グラフに表示します。

### 開き方（おすすめ）
`fetch()` を使うので、ローカルサーバーで開くのが安心です。

1. プロジェクトフォルダでターミナルを開く
2. これを実行：
   - `python -m http.server 8000`
3. ブラウザで開く：
   - `http://localhost:8000/simulation/index.html`

### テストの仕組み（かんたん）
- **Start Test** を押すと `./ping.json` を何回も読み込みます
- かかった時間を “遅延 (ms)” として記録します
- Canvas に折れ線グラフを描きます

### データ保存（重要）
- テスト結果は `localStorage` に保存されます（キー名：`networkTestStats`）
- なので、次をしてもデータは残ります：
  - ページ更新（リロード）
  - 別のページに移動
- ただし、**新しいテストを開始** すると、前のデータは新しい結果で置き換わります

### ボタン
- **Start Test**：前のデータを消して、テスト開始
- **Stop**：テスト停止（データは残ります）

### ファイル
- `index.html`：画面のHTML（カードとグラフ）
- `style.css`：テーマとレイアウト
- `script.js`：計測、グラフ描画、`localStorage` 保存
- `ping.json`：テスト用に読む小さいファイル

### 困ったとき
- “local serverで開いてください” みたいなエラーが出る場合、`file://` で開いている可能性が高いです。
- 上の手順でサーバーを起動して、`http://localhost:8000/...` で開いてください。
