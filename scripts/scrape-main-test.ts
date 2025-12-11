
import * as cheerio from 'cheerio';

async function scrapeMainPage() {
    console.log('Fetching main page...');
    const response = await fetch('https://www.asicminervalue.com', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        }
    });
    const html = await response.text();
    const $ = cheerio.load(html);

    const miners: any[] = [];

    // Debug: Dump part of HTML to find the table class
    const htmlSnippet = $('body').html()?.substring(0, 2000);
    console.log('HTML Snippet:', htmlSnippet);

    // Try generic search for Antminer to find where it is
    const antminer = $('tr:contains("Antminer")').first();
    console.log('Antminer Row parent classes:', antminer.parent().parent().attr('class'));
    console.log('Antminer Row parent id:', antminer.parent().parent().attr('id'));

    const rows = $('tr').filter((_, el) => $(el).text().includes('SHA-256'));
    console.log(`Found ${rows.length} rows containing SHA-256.`);

    rows.each((i, row) => {
        const cols = $(row).find('td');
        // Structure usually: Model, Hashrate, Power, Noise, Algo, Profitability columns...
        // Let's try to identify columns by content

        const modelCell = $(cols[0]);
        const name = modelCell.find('a').first().text().trim();
        const slug = modelCell.find('a').attr('href')?.split('/').pop();

        // Release date is often in small text in the first cell
        const releaseDate = modelCell.find('small').text().trim();

        const hashrateRaw = $(cols[1]).text().trim(); // e.g. "200 Th/s"
        const powerRaw = $(cols[2]).text().trim();    // e.g. "3000 W"
        const efficiencyRaw = $(cols[3]).text().trim(); // e.g. "15 j/Th"

        // Price might be hidden or in a specific column?
        // ASIC Miner Value often doesn't show price in the main table easily, 
        // sometimes it's profitability.
        // Wait, looking at the previous 'view_content_chunk' output (Step 494):
        // It showed "[$9,590$19/Th]". This suggests price IS there.
        // Let's dump the text of the columns to see where Price is.

        if (i < 3) {
            console.log(`Row ${i} Full Text:`, $(row).text().replace(/\s+/g, ' '));
        }

        miners.push({
            name,
            slug,
            releaseDate,
            hashrateRaw,
            powerRaw,
            efficiencyRaw
        });
    });
}

scrapeMainPage();
