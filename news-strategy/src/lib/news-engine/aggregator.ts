import { fetchGoogleNews, fetchNewsAPI, fetchRSS, fetchFinageNews, fetchRedditRSS } from './sources';
import { getDailyIndex, saveDailyIndex } from './storage';
import { DailyNewsIndex, NewsItem } from './types';
import { analyzeSentimentBatch } from './sentiment';

// CELEBRITY KEYWORDS
const CELEBS = ['Elon Musk', 'Michael Saylor', 'Vitalik Buterin', 'Cathie Wood', 'Sam Bankman-Fried', 'CZ Binance'];
// MINING COMPANIES
const MINERS = ['Marathon Digital', 'Riot Platforms', 'CleanSpark', 'Bitmain', 'Canaan Creative'];

export async function runNewsIngest() {
    console.log("Igniting News Engine (Phase 8)...");

    const promises: Promise<NewsItem[]>[] = [];

    // 1. Fetch from Sources

    // Crypto Core (CoinDesk RSS)
    promises.push(fetchRSS('https://www.coindesk.com/arc/outboundfeeds/rss/', 'Crypto', 'CoinDesk'));

    // **NEW** Finage (Institutional / "Sane")
    promises.push(fetchFinageNews('global', 'Crypto'));

    // **NEW** Social / "Crazy" (Reddit)
    promises.push(fetchRedditRSS('Bitcoin', 'Crypto'));
    promises.push(fetchRedditRSS('CryptoCurrency', 'Crypto'));

    // Mining Specific (Google News)
    const minerQuery = MINERS.map(m => `"${m}"`).join(' OR ');
    promises.push(fetchGoogleNews(`${minerQuery} + bitcoin`, 'Mining'));

    // Celebrity Tracker (Google News)
    const celebQuery = CELEBS.map(c => `"${c}"`).join(' OR ');
    promises.push(fetchGoogleNews(`${celebQuery} + crypto`, 'Celeb'));

    // Await all sources
    const results = await Promise.all(promises);
    const freshItems = results.flat();
    console.log(`Fetched ${freshItems.length} raw items.`);

    // 2. Load Existing & Merge
    const today = new Date().toISOString().split('T')[0];
    const existingIndex = await getDailyIndex(today) || { date: today, lastUpdated: '', items: [] };

    // 3. Identify New Items (Deduplication)
    const existingIds = new Set(existingIndex.items.map(i => i.id));
    const newItems: NewsItem[] = [];

    for (const item of freshItems) {
        if (!existingIds.has(item.id)) {
            newItems.push(item);
            existingIds.add(item.id);
        }
    }

    console.log(`Identified ${newItems.length} new unique items.`);

    // 4. Run Sentiment Analysis (Batch)
    let enrichedItems: NewsItem[] = newItems;
    if (newItems.length > 0) {
        try {
            // Limit batch size to prevent timeouts
            const MAX_BATCH = 20;
            if (newItems.length > MAX_BATCH) {
                const chunk = newItems.slice(0, MAX_BATCH);
                const analyzedChunk = await analyzeSentimentBatch(chunk);
                // Append the rest without analysis (or analyze in chunks if needed, but saving tokens for now)
                enrichedItems = [...analyzedChunk, ...newItems.slice(MAX_BATCH)];
            } else {
                enrichedItems = await analyzeSentimentBatch(newItems);
            }
        } catch (e) {
            console.error("Sentiment batch failed, proceeding with raw items", e);
        }
    }

    // 5. Push enriched items to index
    existingIndex.items.push(...enrichedItems);

    existingIndex.lastUpdated = new Date().toISOString();
    // Sort by date descending
    existingIndex.items.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    // 6. Save
    await saveDailyIndex(existingIndex);
    console.log(`Ingest Complete. Added ${enrichedItems.length} new enriched items. Total: ${existingIndex.items.length}`);

    return existingIndex;
}



