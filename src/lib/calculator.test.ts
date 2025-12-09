import { MiningCalculator, MinerProfile, ContractTerms, MarketConditions, SimulationConfig } from './calculator';

describe('MiningCalculator', () => {
    const miner: MinerProfile = {
        name: 'S21 Pro',
        hashrateTH: 235,
        powerWatts: 3500, // Approx for 15J/TH * 235 = 3525
        price: 2500
    };

    const contract: ContractTerms = {
        electricityRate: 0.06,
        opexRate: 0,
        poolFee: 1.0,
        contractDurationYears: 1
    };

    const market: MarketConditions = {
        btcPrice: 60000,
        networkDifficulty: 80000000000000, // Approx 80T
        blockReward: 3.125,
        difficultyGrowthMonthly: 0, // Flat for baseline test
        btcPriceGrowthAnnual: 0 // Flat for baseline test
    };

    const config: SimulationConfig = {
        startDate: new Date('2024-01-01'),
        initialInvestment: 2500,
        reinvestMode: 'hold'
    };

    test('calculates basic daily production correctly', () => {
        const result = MiningCalculator.calculate(miner, contract, market, config);
        const firstDay = result.projections[0];

        // Manual calc check
        // Hashrate H = 235 * 10^12
        // Diff = 80 * 10^12
        // Factor = (235 * 10^12 * 600 * 3.125 * 144) / (80 * 10^12 * 2^32)
        // = (235 * 600 * 3.125 * 144) / (80 * 4294967296)
        // = 63450000 / 343597383680
        // = 0.00018466 approx

        // Let's check the value
        expect(firstDay.grossProductionBTC).toBeCloseTo(0.00018466, 7);
        expect(firstDay.netProductionBTC).toBeCloseTo(0.00018466 * 0.99, 7);
    });

    test('handles difficulty growth', () => {
        const growthMarket = { ...market, difficultyGrowthMonthly: 10 }; // 10% monthly
        const result = MiningCalculator.calculate(miner, contract, growthMarket, config);

        // Day 0 should be same
        expect(result.projections[0].difficulty).toBe(market.networkDifficulty);

        // Day 15 (index 14) should have increased
        // 14 days growth approx (1.1)^(14/30)
        const expectedGrowth = Math.pow(1.1, 14 / 30);
        expect(result.projections[14].difficulty).toBeCloseTo(market.networkDifficulty * expectedGrowth, 0);
    });

    test('detects breakeven', () => {
        // High price to ensure breakeven
        const highPriceMarket = { ...market, btcPrice: 1000000 };
        const result = MiningCalculator.calculate(miner, contract, highPriceMarket, config);

        expect(result.summary.breakevenDate).not.toBeNull();
    });

    test('handles halving correctly', () => {
        // Set halving date to 10 days from start
        const halvingDate = new Date(config.startDate);
        halvingDate.setDate(halvingDate.getDate() + 10);

        const halvingMarket = { ...market, nextHalvingDate: halvingDate };
        const result = MiningCalculator.calculate(miner, contract, halvingMarket, config);

        // Day 9: Normal reward
        expect(result.projections[9].blockReward).toBe(3.125);

        // Day 10: Halved reward
        expect(result.projections[10].blockReward).toBe(1.5625);

        // Production should drop by half (approx, assuming diff/price constant)
        expect(result.projections[10].grossProductionBTC).toBeCloseTo(result.projections[9].grossProductionBTC / 2, 7);
    });

    test('triggers shutdown when revenue < cost', () => {
        // Low price to force shutdown
        const lowPriceMarket = { ...market, btcPrice: 100 }; // Very low price
        const result = MiningCalculator.calculate(miner, contract, lowPriceMarket, config);

        expect(result.summary.shutdownDate).not.toBeNull();

        // Find the shutdown day
        const shutdownDayIndex = result.projections.findIndex(p => p.isShutdown);
        expect(shutdownDayIndex).toBeGreaterThan(-1);

        // Ensure subsequent days are also shutdown
        if (shutdownDayIndex < result.projections.length - 1) {
            expect(result.projections[shutdownDayIndex + 1].isShutdown).toBe(true);
            expect(result.projections[shutdownDayIndex + 1].grossProductionBTC).toBe(0);
        }
    });

    test('handles sell_daily strategy', () => {
        const sellConfig: SimulationConfig = { ...config, reinvestMode: 'sell_daily' };
        const result = MiningCalculator.calculate(miner, contract, market, sellConfig);

        // BTC Held should be 0
        expect(result.projections[10].btcHeld).toBe(0);

        // Cash balance should increase (or decrease less) as we sell BTC
        // Revenue is realized
        expect(result.projections[10].cumulativeRevenueUSD).toBeGreaterThan(0);
    });

    test('handles hold strategy', () => {
        const holdConfig: SimulationConfig = { ...config, reinvestMode: 'hold' };
        const result = MiningCalculator.calculate(miner, contract, market, holdConfig);

        // BTC Held should increase
        expect(result.projections[10].btcHeld).toBeGreaterThan(0);

        // Cumulative Revenue (Realized) should be 0 (since we hold)
        // Wait, logic says: cumulativeRevenueUSD tracks "Realized + Unrealized"? 
        // Let's check logic: 
        // if sell_daily: cumulativeRevenueUSD += dailyRevenueUSD
        // if hold: cumulativeRevenueUSD is NOT incremented daily.
        // So for hold, cumulativeRevenueUSD should be 0?
        // Let's check the code: 
        // Line 218: "Let's track Realized Revenue."
        // Line 264: totalRevenueUSD: cumulativeRevenueUSD + (btcHeld * currentBtcPrice)

        expect(result.projections[10].cumulativeRevenueUSD).toBe(0);

        // But Portfolio Value should include BTC value
        expect(result.projections[10].portfolioValueUSD).toBeGreaterThan(result.projections[10].cashBalance);
    });
});
