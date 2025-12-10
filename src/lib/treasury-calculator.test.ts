
import { TreasuryCalculatorLogic } from './treasury-calculator';
import { MinerProfile, ContractTerms, MarketConditions, SimulationConfig } from './calculator';

describe('TreasuryCalculatorLogic', () => {
    it('should stop generating projections after shutdown date', () => {
        // Setup: High OpEx to force early shutdown
        const miner: MinerProfile = {
            name: 'Test Miner',
            hashrateTH: 100,
            powerWatts: 3000,
            price: 5000
        };

        const contract: ContractTerms = {
            electricityRate: 10.0, // Very high rate to force immediate shutdown
            opexRate: 0,
            poolFee: 1,
            contractDurationYears: 5,
            advancePaymentYears: 0,
            hardwareCostUSD: 4000
        };

        const market: MarketConditions = {
            btcPrice: 60000,
            networkDifficulty: 80000000000000,
            blockReward: 3.125,
            difficultyGrowthMonthly: 0,
            btcPriceGrowthAnnual: 0
        };

        const config: SimulationConfig = {
            startDate: new Date('2024-01-01'),
            initialInvestment: 5000,
            reinvestMode: 'hold'
        };

        const result = TreasuryCalculatorLogic.calculate(miner, contract, market, config);

        // Verification
        // 1. Should be shutdown
        expect(result.summary.shutdownDate).not.toBeNull();
        expect(result.summary.shutdownReason).toContain('Unprofitable');

        // 2. Projections should stop at shutdown
        // If contract is 5 years (1825 days), and shutdown happens on day 0 or 1,
        // we expect very few projection entries, not 1825.

        console.log(`Summary Shutdown Date: ${result.summary.shutdownDate}`);
        console.log(`Total Days from Summary: ${result.summary.totalDays}`);
        console.log(`Projections Length: ${result.projections.length}`);

        expect(result.projections.length).toBeLessThan(1825); // Should be significantly less than 5 years

        // precise check: it might produce one "shutdown" entry and stop
        // The current logic produces 'totalDays' entries. The fix should make it produce ~1-2 entries.
    });

    it('should convert advance payment immediately to BTC (regression test)', () => {
        // Setup: Contract with advance payment
        const miner: MinerProfile = {
            name: 'Test Miner',
            hashrateTH: 100,
            powerWatts: 0, // No power cost to isolate advance payment math
            price: 0
        };

        const contract: ContractTerms = {
            electricityRate: 0.05,
            opexRate: 0.01,
            poolFee: 0,
            contractDurationYears: 1,
            advancePaymentYears: 1, // 1 Year Advance
            hardwareCostUSD: 0
        };

        const market: MarketConditions = {
            btcPrice: 50000,
            networkDifficulty: 80e12, // Realistic difficulty
            blockReward: 3.125,
            difficultyGrowthMonthly: 0,
            btcPriceGrowthAnnual: 0
        };

        const config: SimulationConfig = {
            startDate: new Date('2024-01-01'),
            initialInvestment: 0,
            reinvestMode: 'hold'
        };

        // Advance Calc:
        // Daily Cost = 0 kw * ... Wait, power is 0.
        // Let's set powerWatts so there IS a cost.
        miner.powerWatts = 1000; // 1 kW => 24 kWh/day
        // Daily USD = 24 * (0.05 + 0.01) = 24 * 0.06 = 1.44 USD/day
        // Yearly = 1.44 * 365 = 525.6 USD
        // Advance Payment = 525.6 USD
        // Converted to BTC @ 50,000 = 525.6 / 50000 = 0.010512 BTC

        const result = TreasuryCalculatorLogic.calculate(miner, contract, market, config);
        const initialProjection = result.projections[0];

        // Verification
        // Treasury BTC should be approx 0.010512 (plus/minus small mining yield from day 0 if any, but `initialBTC` is the starting point)
        // Actually `treasuryBTC` in projection[0] includes the effects of Day 0.
        // But we can check `summary.initialInvestmentUSD`?
        // Or we can check that `treasuryCash` is 0.

        // 1. Cash should be 0 (because we converted to BTC)
        expect(initialProjection.treasuryCash).toBeCloseTo(0, 5);

        // 2. Treasury BTC should be roughly Advance Payment BTC
        // (It changes slightly due to daily mining yield, but should be > 0.01)
        expect(initialProjection.treasuryBTC).toBeGreaterThan(0.01);
    });
});
