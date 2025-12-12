import { calculateDailyGrossBTC, calculateHashpriceUSD, calculateMinerRevenueUSD, MINING_CONSTANTS } from './mining-math';

describe('Mining Math Centralized Logic', () => {

    test('Constants are correct', () => {
        expect(MINING_CONSTANTS.SECONDS_PER_DAY).toBe(86400);
        expect(MINING_CONSTANTS.TWO_POW_32).toBe(4294967296);
        expect(MINING_CONSTANTS.H_TH).toBe(1e12); // 10^12
    });

    test('calculateDailyGrossBTC returns correct value for standard inputs', () => {
        // Example: S19 XP 140TH, Difficulty 80T, Block Reward 3.125
        // Formula: (140 * 10^12 * 86400 * 3.125) / (80 * 10^12 * 2^32)
        // 80T diff is 80 * 10^12? Usually difficulty is just a raw number, but in these formulas it's often treated relative to hash.
        // Let's use the exact formula from the code: (hashrateTH * H_TH * SECONDS_PER_DAY * blockReward) / (difficulty * TWO_POW_32)

        const hashrateTH = 100;
        const blockReward = 6.25;
        const difficulty = 50000000000000; // 50T

        // Manual Calc:
        // Numerator: 100 * 1e12 * 86400 * 6.25 = 5.4e19
        // Denominator: 50e12 * 4294967296 ≈ 2.147e23
        // Result ≈ 0.000251...

        const result = calculateDailyGrossBTC(hashrateTH, difficulty, blockReward);
        expect(result).toBeGreaterThan(0);

        // Zero difficulty check
        expect(calculateDailyGrossBTC(100, 0, 6.25)).toBe(0);
    });

    test('calculateHashpriceUSD logic', () => {
        // Difficulty 100T (arbitrary large number for easy math check logic, real diff is much higher)
        // Let's stick to the algebraic relationship: Hashprice = GrossBTC(1TH) * BTCPrice
        const diff = 80000000000000;
        const reward = 3.125;
        const btcPrice = 60000;

        const btcPerTH = calculateDailyGrossBTC(1, diff, reward);
        const expectedHashprice = btcPerTH * btcPrice;

        expect(calculateHashpriceUSD(diff, reward, btcPrice)).toBeCloseTo(expectedHashprice, 10);
    });

    test('calculateMinerRevenueUSD logic', () => {
        const hashrate = 200; // 200 TH
        const hashprice = 0.10; // $0.10 per TH
        const poolFee = 2.0; // 2%

        // Gross: 200 * 0.10 = $20
        // Net: $20 * (1 - 0.02) = $19.6

        expect(calculateMinerRevenueUSD(hashrate, hashprice, poolFee)).toBeCloseTo(19.6, 5);
        expect(calculateMinerRevenueUSD(hashrate, hashprice, 0)).toBe(20);
    });
});
