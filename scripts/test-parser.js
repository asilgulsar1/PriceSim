
const sampleText = `
🇭🇰 Stock in Hong Kong:
- S21xp 270T: 23.6u/t (SPOT)
- S21+225T: 15.3u/t (SPOT)
- S21+235T: 15.4u/t (SPOT)
- S21+216T mix: 15.3u/t (Mar.)
- S21+216T mix: 15u/t (Apr.)
- S21+216T mix: 14.8u/t (May)
- S19k pro 120T: 9.3u/t (SPOT)
- S19k pro 115T: 8.9u/t (SPOT)
- S19k pro 110T: 8.4u/t (SPOT)
- S21+ hyd 319T: 15.3u/t (SPOT)
- S21+ hyd 358T: 16.2u/t (SPOT)
- S21+ hyd 395T: 16.7u/t (SPOT)
- S21+ hyd 358Tmix: 16u/t (Mar.)
- A2 226T Mix: 15.5u/t (Mar.)
- A2 Hyd 446T Mix: 15.5u/t (Mar.)
- T21 mix: 14.3u/t (SPOT)
- T21 190T: 14.5u/t (SPOT)
- KS5 pro 21T: 2000u (SPOT)
- KS5 20T: 1900u (SPOT)
- L9 15G: 9800u (SPOT)
- ⭐️L9 16G: 10500u (SPOT)
- L9 17G: 11400u (SPOT)
- L9 16G mix: 10100u (Apr.)
- L7 9050M mix: 4199u (Jun.)

🇷🇺 Local Stock in Russia:
- S21+225T (GTD): 4050u (SPOT)
- S21+235T (GTD): 4300u (SPOT)
- T21 190T (GTD): 3150u (SPOT)
- S21+ hyd 358T (GTD): 6624u (SPOT)
- S21+ hyd 395T (GTD): 7685u (SPOT)
- S19kpro 110T (GTD): 980u (SPOT)
- L9 15G (GTD): 11000u (SPOT)
- L9 16G (GTD): 11300u (SPOT)
- L9 17G (GTD): 12200u (SPOT)
`;

function parseHKPrices(text) {
    const lines = text.split('\n');
    let isHKSection = false;
    const hkLines = [];

    // Identifiers for HK section start
    const hkIdentifiers = [/🇭🇰/, /Hong Kong/i, /HK\s*Stock/i, /HK\s*Spot/i];
    // Identifiers for other sections (to stop capturing)
    const otherIdentifiers = [/🇷🇺/, /🇺🇸/, /Russia/i, /USA/i, /Malaysia/i, /Thailand/i, /Paraguay/i];

    for (const line of lines) {
        // Check if a new section starts
        const isNewSection = hkIdentifiers.some(r => r.test(line)) || otherIdentifiers.some(r => r.test(line));

        if (isNewSection) {
            // Determine if it is HK
            isHKSection = hkIdentifiers.some(r => r.test(line));
            continue; // Skip the header line itself? Or keep it? Let's skip for clean data, or keep for context.
        }

        if (isHKSection && line.trim().length > 0) {
            hkLines.push(line.trim());
        }
    }

    return hkLines;
}

const extracted = parseHKPrices(sampleText);
console.log("Extracted HK Lines:");
console.log(extracted.join('\n'));
