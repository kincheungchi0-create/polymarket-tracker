export const fetchTrendingMarkets = async () => {
    try {
        // We use the Gamma API to get top active markets (up to 1000)
        const res = await fetch('/api/polymarket/events?limit=1000&active=true&closed=false');
        const data = await res.json();
        return data;
    } catch (error) {
        console.error("Error fetching trending markets:", error);
        return [];
    }
};

export const fetchMarketById = async (idOrSlug) => {
    try {
        const isId = !isNaN(idOrSlug);
        const url = isId
            ? `/api/polymarket/events/${idOrSlug}`
            : `/api/polymarket/events?slug=${idOrSlug}`;
        const res = await fetch(url);
        const data = await res.json();
        if (Array.isArray(data)) return data[0];
        return data;
    } catch (error) {
        console.error(`Error fetching market ${idOrSlug}:`, error);
        return null;
    }
};

export const fetchMarkets = async (ids) => {
    try {
        const promises = ids.map(id => fetchMarketById(id));
        const results = await Promise.all(promises);
        return results.filter(r => r !== null && r !== undefined);
    } catch (error) {
        console.error("Error fetching multiple markets:", error);
        return [];
    }
};

// KALSHI API
export const fetchKalshiTrending = async () => {
    try {
        const res = await fetch('/api/kalshi/trade-api/v2/markets?status=open&limit=1000');
        const data = await res.json();
        if (data.markets) {
            // Sort by volume descending and return all
            return data.markets.sort((a, b) => (b.volume_24h || 0) - (a.volume_24h || 0));
        }
        return [];
    } catch (error) {
        console.error("Error fetching Kalshi trending:", error);
        return [];
    }
};

export const fetchKalshiMarket = async (ticker) => {
    try {
        const res = await fetch(`/api/kalshi/trade-api/v2/markets/${ticker}`);
        const data = await res.json();
        return data.market;
    } catch (error) {
        console.error(`Error fetching Kalshi market ${ticker}:`, error);
        return null;
    }
};

export const fetchKalshiMarkets = async (tickers) => {
    try {
        const promises = tickers.map(t => fetchKalshiMarket(t));
        const results = await Promise.all(promises);
        return results.filter(r => r !== null && r !== undefined);
    } catch (error) {
        console.error("Error fetching multiple Kalshi markets:", error);
        return [];
    }
};
