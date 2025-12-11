import Parser from 'rss-parser';
import { NewsItem, SourceCategory } from './types';
import crypto from 'crypto';

const parser = new Parser();

// Helper to generate consistent IDs
function generateId(url: string): string {
    return crypto.createHash('md5').update(url).digest('hex');
}

export async function fetchRSS(url: string, category: SourceCategory, sourceName: string): Promise<NewsItem[]> {
    try {
        const feed = await parser.parseURL(url);
        return feed.items.map(item => ({
            id: generateId(item.link || item.title || ''),
            title: item.title || 'Untitled',
            url: item.link || '',
            source: sourceName,
            publishedAt: item.pubDate || new Date().toISOString(),
            category,
            description: item.contentSnippet || item.content?.substring(0, 200) || '',
            tags: []
        })).slice(0, 10); // Limit to top 10
    } catch (e) {
        console.error(`RSS Fetch Failed for ${sourceName}:`, e);
        return [];
    }
}

export async function fetchNewsAPI(query: string, category: SourceCategory): Promise<NewsItem[]> {
    const apiKey = process.env.NEWSAPI_KEY;
    if (!apiKey) return [];

    try {
        const res = await fetch(`https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&language=en&pageSize=10&apiKey=${apiKey}`);
        const data = await res.json();

        if (!data.articles) return [];

        return data.articles.map((a: any) => ({
            id: generateId(a.url),
            title: a.title,
            url: a.url,
            source: a.source.name,
            publishedAt: a.publishedAt,
            category,
            description: a.description,
            tags: []
        }));
    } catch (e) {
        console.error(`NewsAPI Fetch Failed for ${category}:`, e);
        return [];
    }
}

export async function fetchGoogleNews(query: string, category: SourceCategory): Promise<NewsItem[]> {
    // Google News RSS: https://news.google.com/rss/search?q={QUERY}&hl=en-US&gl=US&ceid=US:en
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}+when:1d&hl=en-US&gl=US&ceid=US:en`;
    return fetchRSS(rssUrl, category, 'Google News');
}

export async function fetchFinageNews(query: string, category: SourceCategory): Promise<NewsItem[]> {
    const apiKey = process.env.FINAGE_API_KEY;
    if (!apiKey) return [];

    try {
        // Finage Crypto News Endpoint
        const res = await fetch(`https://api.finage.co.uk/news/cryptocurrency?apikey=${apiKey}`);
        const data = await res.json();

        // Finage structure: { news: [ { title, description, url, publicationTime, source, ... } ] }
        if (!data.news) return [];

        return data.news.map((a: any) => ({
            id: generateId(a.url),
            title: a.title,
            url: a.url,
            source: a.source || 'Finage',
            publishedAt: a.publicationTime || new Date().toISOString(),
            category, // Usually 'Macro' or 'Crypto' (Sane)
            description: a.description,
            tags: ['[Insti]'] // Institutional/Sane Tag
        })).slice(0, 15);
    } catch (e) {
        console.error(`Finage Fetch Failed:`, e);
        return [];
    }
}

export async function fetchRedditRSS(subreddit: string, category: SourceCategory): Promise<NewsItem[]> {
    try {
        // Reddit RSS: https://www.reddit.com/r/{subreddit}/hot.rss
        const url = `https://www.reddit.com/r/${subreddit}/hot.rss`;
        const items = await fetchRSS(url, category, `Reddit r/${subreddit}`);

        // Add bias tag
        return items.map(i => ({
            ...i,
            tags: ['[Social]', '[Crazy]'] // Social/Crazy Tag
        }));
    } catch (e) {
        console.error(`Reddit RSS Failed for ${subreddit}:`, e);
        return [];
    }
}
