# BTC Lite Trade — Demo

一個單檔可部署的教學用前端：
- 即時 BTC/USDT K 線（Binance 公開 API + WebSocket）
- 做多/做空的「模擬下單」，本地計算 PnL，無任何後端、無實單
- 跨平台純前端，直接打開 `index.html` 就能跑

> **注意**：僅供教學/研究。若要接入真實交易，請自行串接交易所 API（含鑰匙保管、下單、風控、KYC 等）。

## 快速開始
1. 下載本專案 ZIP 並解壓
2. 直接用瀏覽器打開 `index.html`（有時瀏覽器會阻擋 `file://` 的 WebSocket，建議用小型伺服器啟動：）

```bash
# Python 3
python -m http.server 8080
# or Node
npx serve . -p 8080
```
打開 http://localhost:8080

## 架構
- `index.html` — 版面、掛載圖表與控制面板
- `styles.css` — 極簡暗色 UI
- `app.js` — 圖表渲染、K 線資料、WebSocket 即時更新、模擬下單

## 可擴充方向
- ✅ 指標：MA/EMA/RSI/MACD（可用前端計算或技術指標庫）
- ✅ 訂單簿 / 即時成交（再開兩路 WebSocket）
- ✅ 多幣種 / 多交易所切換
- ✅ 真實下單：後端代理 + 交易所 REST/WS（需要 API Key 與簽名）
- ✅ 使用者帳號 / 資產：自架後端 + DB（PostgreSQL/SQLite）

## 免責聲明
本專案無任何保證，交易有風險，請自行評估。
