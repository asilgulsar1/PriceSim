
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
});
