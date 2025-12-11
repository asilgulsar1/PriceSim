
import {
    calculateMiddlePrice,
    extractHashrateFromName,
    parseMinerSpecs
} from './asic-marketplace-service';

// We need to export these functions from the service to test them isolatedly.
// Mock cheerio to avoid ESM/Jest issues since we only test pure logic functions here
jest.mock('cheerio', () => ({
    load: jest.fn()
}));

// Currently they are likely not exported. I will need to update the service file first 
// or I can rely on correct exports. Assuming I will export them.

describe('ASIC Marketplace Service Logic', () => {

    describe('extractHashrateFromName', () => {
        test('parses Th/s correctly', () => {
            expect(extractHashrateFromName('Antminer S19 (95Th)')).toBe(95);
            expect(extractHashrateFromName('Antminer S19 XP (140.5 Th)')).toBe(140.5);
            expect(extractHashrateFromName('Model X 100Th/s')).toBe(100);
        });

        test('parses Ph/s correctly', () => {
            expect(extractHashrateFromName('Antminer S21 Hyd (1.1Ph)')).toBe(1100);
            expect(extractHashrateFromName('Container 1.2 Ph/s')).toBe(1200);
        });

        test('parses Gh/s correctly', () => {
            expect(extractHashrateFromName('L7 (9500Gh)')).toBe(9.5);
            expect(extractHashrateFromName('Home miner 500 Gh/s')).toBe(0.5);
        });

        test('returns 0 for invalid input', () => {
            expect(extractHashrateFromName('Random Miner Name')).toBe(0);
        });
    });

    describe('calculateMiddlePrice (Smart Consensus)', () => {
        test('handles empty array', () => {
            expect(calculateMiddlePrice([])).toBe(0);
        });

        test('handles single value', () => {
            expect(calculateMiddlePrice([1000])).toBe(1000); // 1000 / 1
        });

        test('handles 2 values (average)', () => {
            expect(calculateMiddlePrice([1000, 2000])).toBe(1500);
        });

        test('identifies consensus cluster (Basic)', () => {
            // Cluster A: 3000, 3100 (Avg ~3050, 2 items)
            // Cluster B: 9000 (1 item)
            // Should pick Cluster A
            const prices = [3000, 3100, 9000];
            expect(calculateMiddlePrice(prices)).toBeCloseTo(3050, -1);
        });

        test('identifies consensus cluster (Complex)', () => {
            // Cluster A: 1000 (1 item)
            // Cluster B: 3000, 3050, 3100, 3200 (Avg ~3087, 4 items)
            // Cluster C: 5000, 5200 (2 items)
            const prices = [1000, 3000, 3050, 5000, 5200, 3100, 3200];
            const result = calculateMiddlePrice(prices);
            // Expected average of Cluster B: (3000+3050+3100+3200)/4 = 3087.5
            expect(result).toBeCloseTo(3088, -1);
        });

        test('handles large outliers', () => {
            // 10 items at $10k
            // 1 item at $100k
            const prices = Array(10).fill(10000).concat([100000]);
            expect(calculateMiddlePrice(prices)).toBe(10000);
        });
        describe('Debugging User Reported Issues', () => {
            test('extractHashrateFromName handles names without explicit hash', () => {
                // "Antminer S23 Hyd 3U" -> 0 if we only look at name. 
                // We need separate logic or verify extraction strategy.
                expect(extractHashrateFromName('Antminer S23 Hyd 3U')).toBe(0);
                // This confirms the bug. We need to pass the hashrate string from the column, not just the name.
            });

            test('detects double names', () => {
                // "Bitmain Antminer S23 Hyd 3U (1.16Ph)Antminer S23 Hyd 3U(1.16Ph)"
                const badName = "Bitmain Antminer S23 Hyd 3U (1.16Ph)Antminer S23 Hyd 3U(1.16Ph)";
                // This is mostly for the scraping logic validation, but we document it here.
            });
        });
    });

    describe('Whatsminer Parsing', () => {
        test('parses Whatsminer hashrate correctly', () => {
            expect(extractHashrateFromName('WhatsMiner M30S++ (110Th)')).toBe(110);
            expect(extractHashrateFromName('WhatsMiner M50 118T')).toBe(118); // Potential failure point?
            expect(extractHashrateFromName('WhatsMiner M30S 88T')).toBe(88);
        });
        describe('parseMinerSpecs', () => {
            test('handles MH/s raw values (scale 1e6)', () => {
                const mockMiner = {
                    name: 'Antminer S23 Hyd 3U', // Name without hash
                    hashrates: [{ hashrate: 1160000000, consumption: 5000 }]
                };
                const result = parseMinerSpecs(mockMiner);
                expect(result.hashrateTH).toBe(1160);
            });

            test('handles standard raw values', () => {
                const mockMiner = {
                    name: 'Miner X',
                    hashrates: [{ hashrate: 120, consumption: 3000 }] // Already TH/s range?
                };
                // My logic: if > 10 and < 10000 -> keep as is.
                const result = parseMinerSpecs(mockMiner);
                expect(result.hashrateTH).toBe(120);
            });
        });
    });
});
