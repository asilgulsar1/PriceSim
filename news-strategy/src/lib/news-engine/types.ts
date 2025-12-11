export type SourceCategory = 'Macro' | 'Crypto' | 'Mining' | 'Celeb' | 'Tech';

export interface NewsItem {
    id: string; // url hash or uuid
    title: string;
    url: string;
    source: string;
    publishedAt: string;
    category: SourceCategory;
    description?: string;
    tags?: string[]; // e.g. ["Elon Musk", "Regulation"]
    sentiment?: {
        score: number; // -1.0 to 1.0 (Bearish to Bullish)
        impact: number; // 0 to 10 (Significance)
        urgency: number; // 0 to 10 (Time-sensitivity)
    };
}

export interface DailyNewsIndex {
    date: string; // YYYY-MM-DD
    lastUpdated: string;
    items: NewsItem[];
}
