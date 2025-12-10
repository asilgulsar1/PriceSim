import { MiningCalculator, MinerProfile, ContractTerms, MarketConditions, SimulationConfig } from './calculator';

describe('Treasury Debug Test', () => {
    test('BTC Held should start positive with full miner price', () => {
        const miner: MinerProfile = {
            name: 'Test Miner',
            hashrateTH: 235,
            powerWatts: 3500,
            price: 2500  // $2,500
        };

        const contract: ContractTerms = {
            electricityRate: 0.06,
            opexRate: 0,
            poolFee: 1.0,
            contractDurationYears: 1
        };

        const market: MarketConditions = {
            btcPrice: 93909,  // ~$94k
            networkDifficulty: 80000000000000,
            blockReward: 3.125,
            difficultyGrowthMonthly: 0,
            btcPriceGrowthMonthly: 0
        };

        const config: SimulationConfig = {
            startDate: new Date('2024-01-01'),
            initialInvestment: 2500,  // Full miner price
            reinvestMode: 'hold'
        };

        const result = MiningCalculator.calculate(miner, contract, market, config);

        // Expected initial BTC = 2500 / 93909 = 0.0266
        const expectedInitialBTC = 2500 / 93909;

        console.log('Expected Initial BTC:', expectedInitialBTC);
        console.log('Actual Day 0 BTC Held:', result.projections[0].btcHeld);
        console.log('Day 0 Net Production:', result.projections[0].netProductionBTC);
        console.log('Day 0 Total Cost:', result.projections[0].totalDailyCostUSD);

        // BTC Held should be positive
        expect(result.projections[0].btcHeld).toBeGreaterThan(0);

        // Should be close to expected (within 1% due to first day operations)
        expect(result.projections[0].btcHeld).toBeGreaterThan(expectedInitialBTC * 0.99);
        expect(result.projections[0].btcHeld).toBeLessThan(expectedInitialBTC * 1.01);
    });
});
