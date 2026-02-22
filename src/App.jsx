import { useState, useEffect, useRef } from 'react';
import {
  fetchTrendingMarkets, fetchMarkets,
  fetchKalshiTrending, fetchKalshiMarkets
} from './api';
import './index.css';

const playAlertSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {
    console.error("Audio playback error", e);
  }
};

function App() {
  const [activeTab, setActiveTab] = useState('polymarket');

  // Polymarket State
  const [polyTrending, setPolyTrending] = useState([]);
  const [polyTrackedIds, setPolyTrackedIds] = useState([]);
  const [polyTrackedData, setPolyTrackedData] = useState([]);
  const [polyInput, setPolyInput] = useState('');
  const [polySearch, setPolySearch] = useState('');

  // Kalshi State
  const [kalshiTrending, setKalshiTrending] = useState([]);
  const [kalshiTrackedIds, setKalshiTrackedIds] = useState([]);
  const [kalshiTrackedData, setKalshiTrackedData] = useState([]);
  const [kalshiInput, setKalshiInput] = useState('');
  const [kalshiSearch, setKalshiSearch] = useState('');

  // Alerts & History
  const previousOddsRef = useRef({});
  const [alerts, setAlerts] = useState({});
  const ALERT_THRESHOLD = 0.05;

  const formatProb = (probString) => {
    if (probString === null || probString === undefined) return "0%";
    const num = parseFloat(probString);
    if (isNaN(num)) return "0%";
    return `${(num * 100).toFixed(1)}%`;
  };

  const getPolyYesProb = (event) => {
    try {
      if (event?.markets?.[0]?.outcomePrices) {
        return event.markets[0].outcomePrices[0];
      }
      if (event?.outcomePrices) {
        const parsed = JSON.parse(event.outcomePrices);
        return parsed[0];
      }
    } catch (e) {
      console.error("Parse error for outcomePrices", event.outcomePrices);
    }
    return null;
  };

  const getKalshiYesProb = (market) => {
    let priceCents = market?.yes_bid;
    if (priceCents === undefined || priceCents === 0) {
      priceCents = market?.last_price;
    }
    if (priceCents !== undefined && priceCents !== null) {
      return (priceCents / 100).toString();
    }
    return null;
  };

  const loadPolyTrending = async () => {
    const data = await fetchTrendingMarkets();
    if (Array.isArray(data)) setPolyTrending(data);
  };

  const loadKalshiTrending = async () => {
    const data = await fetchKalshiTrending();
    if (Array.isArray(data)) setKalshiTrending(data);
  };

  const checkAlerts = (data, getProbFn, idField) => {
    const newAlerts = { ...alerts };
    let soundPlayed = false;

    data.forEach(event => {
      const id = event[idField];
      const currentProb = getProbFn(event);
      if (currentProb !== null) {
        const currentVal = parseFloat(currentProb);
        const prevProb = previousOddsRef.current[id];

        if (prevProb !== undefined) {
          const prevVal = parseFloat(prevProb);
          const diff = Math.abs(currentVal - prevVal);

          if (diff >= ALERT_THRESHOLD) {
            newAlerts[id] = {
              message: `Sudden change! Yes moved by ${(diff * 100).toFixed(1)}%`,
              timestamp: Date.now()
            };
            if (!soundPlayed) {
              playAlertSound();
              soundPlayed = true;
            }
          }
        }
        previousOddsRef.current[id] = currentProb;
      }
    });
    setAlerts(newAlerts);
  };

  const loadPolyTracked = async () => {
    if (polyTrackedIds.length === 0) return;
    const data = await fetchMarkets(polyTrackedIds);
    checkAlerts(data, getPolyYesProb, 'slug');
    setPolyTrackedData(data);
  };

  const loadKalshiTracked = async () => {
    if (kalshiTrackedIds.length === 0) return;
    const data = await fetchKalshiMarkets(kalshiTrackedIds);
    checkAlerts(data, getKalshiYesProb, 'ticker');
    setKalshiTrackedData(data);
  };

  // Trending Intervals
  useEffect(() => {
    loadPolyTrending();
    loadKalshiTrending();
    const invPoly = setInterval(loadPolyTrending, 5 * 60 * 1000);
    const invKalshi = setInterval(loadKalshiTrending, 5 * 60 * 1000);
    return () => { clearInterval(invPoly); clearInterval(invKalshi); };
  }, []);

  // Tracked Intervals
  useEffect(() => {
    loadPolyTracked();
    const interval = setInterval(loadPolyTracked, 15000);
    return () => clearInterval(interval);
  }, [polyTrackedIds]);

  useEffect(() => {
    loadKalshiTracked();
    const interval = setInterval(loadKalshiTracked, 15000);
    return () => clearInterval(interval);
  }, [kalshiTrackedIds]);

  // Alert Cleanup
  useEffect(() => {
    const interval = setInterval(() => {
      setAlerts(prev => {
        const now = Date.now();
        const cleaned = { ...prev };
        let changed = false;
        for (const [key, val] of Object.entries(cleaned)) {
          if (now - val.timestamp > 10000) {
            delete cleaned[key];
            changed = true;
          }
        }
        return changed ? cleaned : prev;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleTrackPoly = (e) => {
    e.preventDefault();
    if (!polyInput.trim()) return;
    const slug = polyInput.trim().replace(/^.*\/event\//, '');
    if (!polyTrackedIds.includes(slug)) setPolyTrackedIds(prev => [...prev, slug]);
    setPolyInput('');
  };

  const handleTrackKalshi = (e) => {
    e.preventDefault();
    if (!kalshiInput.trim()) return;
    const ticker = kalshiInput.trim().toUpperCase();
    if (!kalshiTrackedIds.includes(ticker)) setKalshiTrackedIds(prev => [...prev, ticker]);
    setKalshiInput('');
  };

  return (
    <div className="app-container">
      <header>
        <h1>Prediction Market Tracker</h1>
        <div className="timestamp">Polling every 15s • Threshold: {ALERT_THRESHOLD * 100}%</div>
      </header>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'polymarket' ? 'active' : ''}`}
          onClick={() => setActiveTab('polymarket')}
        >
          Polymarket
        </button>
        <button
          className={`tab ${activeTab === 'kalshi' ? 'active' : ''}`}
          onClick={() => setActiveTab('kalshi')}
        >
          Kalshi
        </button>
      </div>

      {activeTab === 'polymarket' && (
        <div className="dashboard-grid fade-in">
          <section className="panel" style={{ gridColumn: '1 / -1' }}>
            <h2>📈 Top 3 Markets by Volume (Highest Chance)</h2>
            <div className="trending-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
              {polyTrending.length === 0 && <p className="muted">Loading...</p>}
              {[...polyTrending]
                .sort((a, b) => (b.volume || 0) - (a.volume || 0))
                .slice(0, 3)
                .map((event, idx) => (
                  <div key={`top-${event.id || idx}`} className="market-card compact" style={{ margin: 0 }}>
                    <h3 style={{ fontSize: '1.1rem' }}>#{idx + 1} {event.title}</h3>
                    <div className="odds-container" style={{ margin: '1rem 0' }}>
                      <span className="odds-badge odds-yes" style={{ fontSize: '1.2rem', padding: '0.5rem 1rem' }}>
                        {formatProb(getPolyYesProb(event))} Chance
                      </span>
                    </div>
                    <span className="volume">Volume: ${(event.volume || 0).toLocaleString()}</span>
                  </div>
                ))}
            </div>
          </section>

          <section className="panel">
            <h2>🎯 Active Tracker (Polymarket)</h2>
            <form className="input-group" onSubmit={handleTrackPoly}>
              <input
                type="text"
                placeholder="Event Slug (e.g. bitcoin-hits-100k)"
                value={polyInput}
                onChange={(e) => setPolyInput(e.target.value)}
              />
              <button type="submit">Track</button>
            </form>

            <div className="tracked-list">
              {polyTrackedData.length === 0 && <p className="muted">No markets tracked yet.</p>}
              {polyTrackedData.map(event => {
                const yesProb = getPolyYesProb(event);
                const isAlert = !!alerts[event.slug];
                return (
                  <div key={event.slug} className={`market-card ${isAlert ? 'alert' : ''}`}>
                    <h3>{event.title}</h3>
                    <div className="odds-container">
                      <span className="odds-badge odds-yes">Yes: {formatProb(yesProb)}</span>
                      <button className="remove-btn" onClick={() => {
                        setPolyTrackedIds(prev => prev.filter(id => id !== event.slug));
                        setPolyTrackedData(prev => prev.filter(i => i.slug !== event.slug));
                      }}>Remove</button>
                    </div>
                    {isAlert && <div className="alert-message">⚠️ {alerts[event.slug].message}</div>}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="panel">
            <h2>🌍 All Available Markets (Polymarket)</h2>
            <div className="input-group" style={{ marginBottom: '1rem' }}>
              <input
                type="text"
                placeholder="Search markets..."
                value={polySearch}
                onChange={(e) => setPolySearch(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <div className="trending-list">
              {polyTrending.length === 0 && <p className="muted">Loading markets...</p>}
              {polyTrending
                .filter(event => event.title?.toLowerCase().includes(polySearch.toLowerCase()))
                .slice(0, 50)
                .map(event => (
                  <div key={event.id} className="market-card">
                    <h3>{event.title}</h3>
                    <div className="odds-container">
                      <span className="odds-badge odds-yes">Yes: {formatProb(getPolyYesProb(event))}</span>
                      <button className="add-btn" onClick={() => {
                        if (!polyTrackedIds.includes(event.slug)) setPolyTrackedIds(prev => [...prev, event.slug]);
                      }}>+ Track</button>
                    </div>
                    <span className="volume">Volume: ${(event.volume || 0).toLocaleString()}</span>
                  </div>
                ))}
            </div>
          </section>
        </div>
      )}

      {activeTab === 'kalshi' && (
        <div className="dashboard-grid fade-in">
          <section className="panel" style={{ gridColumn: '1 / -1' }}>
            <h2>📈 Top 3 Markets by Volume (Highest Chance)</h2>
            <div className="trending-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
              {kalshiTrending.length === 0 && <p className="muted">Loading...</p>}
              {[...kalshiTrending]
                .sort((a, b) => (b.volume_24h || 0) - (a.volume_24h || 0))
                .slice(0, 3)
                .map((market, idx) => (
                  <div key={`top-${market.ticker || idx}`} className="market-card compact" style={{ margin: 0 }}>
                    <h3 style={{ fontSize: '1.1rem' }}>#{idx + 1} {market.title}</h3>
                    <div className="odds-container" style={{ margin: '1rem 0' }}>
                      <span className="odds-badge odds-yes" style={{ fontSize: '1.2rem', padding: '0.5rem 1rem' }}>
                        {formatProb(getKalshiYesProb(market))} Chance
                      </span>
                    </div>
                    <span className="volume">Volume: ${(market.volume_24h || market.volume || 0).toLocaleString()}</span>
                  </div>
                ))}
            </div>
          </section>

          <section className="panel">
            <h2>🎯 Active Tracker (Kalshi)</h2>
            <form className="input-group" onSubmit={handleTrackKalshi}>
              <input
                type="text"
                placeholder="Market Ticker (e.g. KXPRES-24)"
                value={kalshiInput}
                onChange={(e) => setKalshiInput(e.target.value)}
              />
              <button type="submit">Track</button>
            </form>

            <div className="tracked-list">
              {kalshiTrackedData.length === 0 && <p className="muted">No markets tracked yet.</p>}
              {kalshiTrackedData.map(market => {
                const yesProb = getKalshiYesProb(market);
                const isAlert = !!alerts[market.ticker];
                return (
                  <div key={market.ticker} className={`market-card ${isAlert ? 'alert' : ''}`}>
                    <h3>{market.title}</h3>
                    <div className="odds-container">
                      <span className="odds-badge odds-yes">Yes: {formatProb(yesProb)}</span>
                      <button className="remove-btn" onClick={() => {
                        setKalshiTrackedIds(prev => prev.filter(id => id !== market.ticker));
                        setKalshiTrackedData(prev => prev.filter(i => i.ticker !== market.ticker));
                      }}>Remove</button>
                    </div>
                    {isAlert && <div className="alert-message">⚠️ {alerts[market.ticker].message}</div>}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="panel">
            <h2>🌍 All Available Markets (Kalshi)</h2>
            <div className="input-group" style={{ marginBottom: '1rem' }}>
              <input
                type="text"
                placeholder="Search markets..."
                value={kalshiSearch}
                onChange={(e) => setKalshiSearch(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <div className="trending-list">
              {kalshiTrending.length === 0 && <p className="muted">Loading markets...</p>}
              {kalshiTrending
                .filter(market => market.title?.toLowerCase().includes(kalshiSearch.toLowerCase()))
                .slice(0, 50)
                .map(market => (
                  <div key={market.ticker} className="market-card">
                    <h3>{market.title}</h3>
                    <div className="odds-container">
                      <span className="odds-badge odds-yes">Yes: {formatProb(getKalshiYesProb(market))}</span>
                      <button className="add-btn" onClick={() => {
                        if (!kalshiTrackedIds.includes(market.ticker)) setKalshiTrackedIds(prev => [...prev, market.ticker]);
                      }}>+ Track</button>
                    </div>
                    <span className="volume">Sub-Title: {market.subtitle || 'N/A'}</span>
                  </div>
                ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
