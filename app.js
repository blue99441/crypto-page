// Lightweight BTC chart + mock trading (no real orders).
// Data: Binance public REST/WebSocket. No API keys. For education only.
const API = {
  klines: (symbol, interval, limit=1000) =>
    `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
  wsKline: (symbol, interval) =>
    `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${interval}`
};

const state = {
  symbol: 'BTCUSDT',
  interval: '1m',
  candles: [],
  lastPrice: null,
  pos: [], // {id, side, size, lev, entry, sl, tp}
  fills: [] // {time, side, size, price}
};

// --- UI helpers ---
const $ = s => document.querySelector(s);
const elLast = $('#lastPrice');
const elChange = $('#priceChange');
const elPositions = $('#positions');
const elFills = $('#fills');
const darkMode = $('#darkMode');

// --- Chart setup ---
let chart, candleSeries, volumeSeries;
let ws;

function initChart(theme='dark'){
  const chartEl = document.getElementById('chart');
  const volEl = document.getElementById('volume');
  chartEl.innerHTML = ''; volEl.innerHTML = '';
  const common = {
    layout: { background: { type: 'Solid', color: theme==='dark' ? '#131922' : '#ffffff' },
              textColor: theme==='dark' ? '#e8eef2' : '#1e2936' },
    grid: { vertLines: { color: theme==='dark' ? '#1f2630' : '#e9eef5' },
            horzLines: { color: theme==='dark' ? '#1f2630' : '#e9eef5' } },
    timeScale: { timeVisible: true, secondsVisible: false, borderVisible:false },
    rightPriceScale: { borderVisible:false }
  };
  chart = LightweightCharts.createChart(chartEl, { ...common, width: chartEl.clientWidth, height: 420 });
  candleSeries = chart.addCandlestickSeries({
    upColor: '#2ecc71', downColor: '#ff5252', borderUpColor: '#2ecc71',
    borderDownColor: '#ff5252', wickUpColor: '#2ecc71', wickDownColor: '#ff5252'
  });

  const volChart = LightweightCharts.createChart(volEl, { ...common, width: volEl.clientWidth, height: 120 });
  volumeSeries = volChart.addHistogramSeries({ priceFormat: { type: 'volume' } });

  window.addEventListener('resize', () => {
    chart.applyOptions({ width: chartEl.clientWidth });
    volChart.applyOptions({ width: volEl.clientWidth });
  });
}

function mapKlines(raw){
  return raw.map(k => ({
    time: Math.floor(k[0]/1000),
    open: parseFloat(k[1]), high: parseFloat(k[2]), low: parseFloat(k[3]), close: parseFloat(k[4]),
    volume: parseFloat(k[5])
  }));
}

async function loadCandles(){
  const url = API.klines(state.symbol, state.interval, 500);
  const res = await fetch(url);
  const raw = await res.json();
  state.candles = mapKlines(raw);
  candleSeries.setData(state.candles);
  volumeSeries.setData(state.candles.map(c => ({ time:c.time, value:c.volume, color: c.close>=c.open ? '#2ecc71' : '#ff5252' })));
  if(state.candles.length){
    const last = state.candles[state.candles.length-1].close;
    state.lastPrice = last;
    elLast.textContent = last.toFixed(2);
    updateChange();
  }
}

function updateChange(){
  const first = state.candles.at(0)?.open ?? state.lastPrice;
  const diff = (state.lastPrice - first);
  const pct = first ? diff/first*100 : 0;
  elChange.textContent = `${diff>=0?'+':''}${diff.toFixed(2)} (${pct.toFixed(2)}%)`;
  elChange.style.color = diff>=0 ? '#2ecc71' : '#ff5252';
}

function connectWS(){
  if(ws) ws.close();
  ws = new WebSocket(API.wsKline(state.symbol, state.interval));
  ws.onmessage = (e)=>{
    try{
      const data = JSON.parse(e.data);
      if(!data.k) return;
      const k = data.k;
      const bar = {
        time: Math.floor(k.t/1000),
        open: parseFloat(k.o), high: parseFloat(k.h), low: parseFloat(k.l), close: parseFloat(k.c),
        volume: parseFloat(k.v)
      };
      const last = state.candles[state.candles.length-1];
      if(last && bar.time === last.time){
        state.candles[state.candles.length-1] = bar;
        candleSeries.update(bar);
      }else{
        state.candles.push(bar);
        candleSeries.update(bar);
      }
      volumeSeries.update({ time: bar.time, value: bar.volume, color: bar.close>=bar.open ? '#2ecc71' : '#ff5252' });
      state.lastPrice = bar.close;
      elLast.textContent = state.lastPrice.toFixed(2);
      updateChange();
      markPnL(); // update PnL markers
    }catch(err){ console.error(err); }
  };
}

// --- Mock trading ---
function renderTables(){
  // positions header
  const ph = `<div class="row-h"><div>方向/價格</div><div>金額</div><div>槓桿</div><div>未實現</div><div>操作</div></div>`;
  const rows = state.pos.map(p=>{
    const pnl = unrealized(p);
    const pnlColor = pnl>=0 ? 'style="color:#2ecc71"' : 'style="color:#ff5252"';
    return `<div class="row-d">
      <div>${p.side.toUpperCase()} @ ${p.entry.toFixed(2)}</div>
      <div>${p.size.toFixed(2)}</div>
      <div>${p.lev}x</div>
      <div ${pnlColor}>${pnl.toFixed(2)}</div>
      <div><button class="btn danger" data-close="${p.id}">平倉</button></div>
    </div>`;
  }).join('');
  elPositions.innerHTML = ph + (rows || `<div class="row-d"><div colspan="5">— 無倉位 —</div></div>`);

  const fh = `<div class="row-h"><div>時間</div><div>方向</div><div>金額</div><div>價格</div><div>—</div></div>`;
  const frows = state.fills.slice().reverse().slice(0, 50).map(f=>{
    return `<div class="row-d">
      <div>${new Date(f.time).toLocaleString()}</div>
      <div>${f.side.toUpperCase()}</div>
      <div>${f.size.toFixed(2)}</div>
      <div>${f.price.toFixed(2)}</div>
      <div></div>
    </div>`;
  }).join('');
  elFills.innerHTML = fh + (frows || `<div class="row-d"><div colspan="5">— 尚無成交 —</div></div>`);

  // bind close buttons
  elPositions.querySelectorAll('button[data-close]').forEach(btn=>{
    btn.addEventListener('click', e=>{
      const id = btn.getAttribute('data-close');
      const idx = state.pos.findIndex(p=>p.id===id);
      if(idx>=0){
        // market close @ lastPrice
        const p = state.pos[idx];
        state.fills.push({ time: Date.now(), side: 'CLOSE', size: p.size, price: state.lastPrice });
        state.pos.splice(idx,1);
        renderTables();
      }
    });
  });
}

function unrealized(p){
  if(!state.lastPrice) return 0;
  const dir = p.side==='long' ? 1 : -1;
  const notional = p.size * p.lev;
  const change = (state.lastPrice - p.entry) * dir;
  return notional * (change / p.entry);
}

function markPnL(){
  // just updates the positions table; chart markers could be added later
  renderTables();
}

function placeOrder(){
  const side = document.querySelector('input[name="side"]:checked').value;
  const size = parseFloat(document.getElementById('size').value);
  const lev = parseInt(document.getElementById('leverage').value);
  const slp = parseFloat(document.getElementById('sl').value);
  const tpp = parseFloat(document.getElementById('tp').value);
  if(!state.lastPrice || isNaN(size) || size<=0) return alert('請輸入正確金額');

  const entry = state.lastPrice;
  const id = Math.random().toString(36).slice(2,9);
  const pos = { id, side, size, lev, entry, sl: slp, tp: tpp };
  state.pos.push(pos);
  state.fills.push({ time: Date.now(), side, size, price: entry });
  renderTables();
}

// --- Wiring ---
function setupToolbar(){
  document.querySelectorAll('.btn[data-int]').forEach(b=>{
    b.addEventListener('click', async ()=>{
      state.interval = b.dataset.int;
      await loadCandles();
      connectWS();
    });
  });
  $('#placeOrder').addEventListener('click', placeOrder);
  $('#closeAll').addEventListener('click', ()=>{
    if(!state.pos.length) return;
    state.pos = [];
    state.fills.push({ time: Date.now(), side: 'FLAT', size: 0, price: state.lastPrice });
    renderTables();
  });

  // theme
  const preferDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  darkMode.checked = preferDark;
  darkMode.addEventListener('change', ()=>{
    initChart(darkMode.checked ? 'dark':'light');
    candleSeries.setData(state.candles);
    volumeSeries.setData(state.candles.map(c => ({ time:c.time, value:c.volume, color: c.close>=c.open ? '#2ecc71' : '#ff5252' })));
  });
}

async function boot(){
  initChart('dark');
  setupToolbar();
  await loadCandles();
  connectWS();
  renderTables();
}

boot().catch(console.error);
