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

    test('treasury depletes over time in normal conditions', () => {
        // Normal market conditions - treasury should deplete
        const result = MiningCalculator.calculate(miner, contract, market, config);

        const initialValue = result.projections[0].portfolioValueUSD;
        const finalValue = result.projections[result.projections.length - 1].portfolioValueUSD;

        // Treasury should have depleted (final < initial)
        expect(finalValue).toBeLessThan(initialValue);
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

    test('treasury model: btcHeld starts high and depletes', () => {
        const result = MiningCalculator.calculate(miner, contract, market, config);

        // Day 0: BTC Held should be close to sale price converted to BTC
        // (slightly less due to first day's operations already applied)
        const expectedInitialBTC = config.initialInvestment / market.btcPrice;
        expect(result.projections[0].btcHeld).toBeCloseTo(expectedInitialBTC, 2);

        // Day 10: BTC Held should have decreased significantly
        expect(result.projections[10].btcHeld).toBeLessThan(expectedInitialBTC * 0.99);

        // Revenue tracks hosting fees received
        expect(result.projections[10].cumulativeRevenueUSD).toBeGreaterThan(0);
    });

    test('treasury model: portfolio value calculation', () => {
        const result = MiningCalculator.calculate(miner, contract, market, config);

        // Portfolio value = cashBalance + (btcHeld * currentPrice)
        const day10 = result.projections[10];
        const expectedPortfolioValue = day10.cashBalance + (day10.btcHeld * day10.btcPrice);

        expect(day10.portfolioValueUSD).toBeCloseTo(expectedPortfolioValue, 2);

        // Portfolio value should be positive (treasury has value)
        expect(day10.portfolioValueUSD).toBeGreaterThan(0);
    });
});
