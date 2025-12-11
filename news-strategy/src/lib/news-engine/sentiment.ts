import { openai } from '../news-service';
import { NewsItem } from './types';

export async function analyzeSentimentBatch(items: NewsItem[]): Promise<NewsItem[]> {
    if (items.length === 0) return [];

    console.log(`Analyzing sentiment for ${items.length} items...`);

    // Prepare batch prompt
    const itemsText = items.map((item, index) =>
        `ID: ${index}\nTitle: ${item.title}\nSource: ${item.source}\nDesc: ${item.description?.slice(0, 150)}`
    ).join('\n---\n');

    const prompt = `
You are a sentiment analyzer for a Bitcoin Mining expert system.
Analyze the following news items.

For each item, provide a JSON object with:
- "score": A float from -1.0 (Very Bearish) to 1.0 (Very Bullish).
- "impact": An integer from 0 to 10. How relevant/significant is this for Bitcoin Mining?
- "urgency": An integer from 0 to 10. Should a sales agent act on this immediately?

Output ONLY a JSON array of objects, corresponding to the input order.
Example:
[
  { "score": 0.8, "impact": 9, "urgency": 7 },
  { "score": -0.2, "impact": 2, "urgency": 1 }
]

Items to analyze:
${itemsText}
`;

    try {
        const completion = await openai.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'gpt-4o',
            response_format: { type: 'json_object' }
        });

        const rawContent = completion.choices[0].message.content || '{"items": []}';

        // Handle different possible JSON structures (array vs object wrapper)
        let scores: any[] = [];
        try {
            const parsed = JSON.parse(rawContent);
            if (Array.isArray(parsed)) {
                scores = parsed;
            } else if (parsed.items && Array.isArray(parsed.items)) {
                scores = parsed.items;
            }
        } catch (e) {
            console.error("Failed to parse sentiment JSON:", e);
            return items; // Return without scores if parse fails
        }

        // Merge scores back into items
        return items.map((item, index) => {
            const score = scores[index];
            if (score && typeof score.score === 'number') {
                return {
                    ...item,
                    sentiment: {
                        score: score.score,
                        impact: score.impact || 5,
                        urgency: score.urgency || 5
                    }
                };
            }
            return item;
        });

    } catch (error) {
        console.error("OpenAI Sentiment Analysis Failed:", error);
        return items; // Return original items on failure
    }
}
