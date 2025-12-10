/**
 * Detailed reconciliation test between Price Simulator and Treasury Calculator
 */

import { PriceSimulatorCalculator } from './price-simulator-calculator';
import { TreasuryCalculatorLogic } from './treasury-calculator';
import { MinerProfile, ContractTerms, MarketConditions, SimulationConfig } from './calculator';

describe('Reconciliation: Price Simulator vs Treasury Calculator', () => {
    // Exact same parameters
    const miner: MinerProfile = {
        name: 'Antminer S21 XP Hydro',
        hashrateTH: 473,
        powerWatts: 5676,
        price: 11975
    };

    const contract: ContractTerms = {
        electricityRate: 0.06,
        opexRate: 0.00,
        poolFee: 1.0,
        contractDurationYears: 5,
        advancePaymentYears: 0,
        setupFeeUSD: 0,
        setupFeeToBTCPercent: 0,
        hardwareCostUSD: 11975, // Match sale price
        markupToBTCPercent: 0, // No markup portion to BTC (100% to cash)
    };

    const market: MarketConditions = {
        btcPrice: 92817,
        networkDifficulty: 109000000000000,
        blockReward: 3.125,
        difficultyGrowthMonthly: 4.0,
        btcPriceGrowthMonthly: 2.5,
        btcPriceGrowthAnnual: 34.5,
        nextHalvingDate: new Date('2028-05-01')
    };

    const config: SimulationConfig = {
        startDate: new Date('2025-01-01'),
        initialInvestment: 11975,
        reinvestMode: 'hold'
    };

    it('should identify exact differences in calculations', () => {
        const priceSimResult = PriceSimulatorCalculator.calculate(miner, contract, market, config);
        const treasuryResult = TreasuryCalculatorLogic.calculate(miner, contract, market, config);

        console.log('\n=== RECONCILIATION ANALYSIS ===\n');

        // Compare key metrics
        console.log('Initial State:');
        console.log(`Price Sim Day 0 BTC: ${priceSimResult.projections[0].btcHeld.toFixed(8)}`);
        console.log(`Treasury Day 0 BTC: ${treasuryResult.projections[0].treasuryBTC.toFixed(8)}`);
        console.log(`Difference: ${Math.abs(priceSimResult.projections[0].btcHeld - treasuryResult.projections[0].treasuryBTC).toFixed(8)}`);

        console.log('\nDay 1 Comparison:');
        const ps1 = priceSimResult.projections[1];
        const tr1 = treasuryResult.projections[1];
        console.log(`Price Sim: Yield=${ps1.netProductionBTC.toFixed(8)} BTC, Cost=${ps1.totalDailyCostUSD.toFixed(2)} USD, BTC Held=${ps1.btcHeld.toFixed(8)}`);
        console.log(`Treasury: Yield=${tr1.dailyYieldBTC.toFixed(8)} BTC, OpEx=${tr1.dailyOpExUSD.toFixed(2)} USD, BTC Held=${tr1.treasuryBTC.toFixed(8)}`);
        console.log(`BTC Difference: ${Math.abs(ps1.btcHeld - tr1.treasuryBTC).toFixed(8)}`);

        // Find first divergence point
        let firstDivergence = -1;
        for (let i = 0; i < Math.min(priceSimResult.projections.length, treasuryResult.projections.length); i++) {
            const psBtc = priceSimResult.projections[i].btcHeld;
            const trBtc = treasuryResult.projections[i].treasuryBTC;
            const diff = Math.abs(psBtc - trBtc);

            if (diff > 0.00000001) { // Tolerance for floating point
                firstDivergence = i;
                console.log(`\nFirst divergence at day ${i}:`);
                console.log(`Price Sim BTC: ${psBtc.toFixed(8)}`);
                console.log(`Treasury BTC: ${trBtc.toFixed(8)}`);
                console.log(`Difference: ${diff.toFixed(8)}`);
                break;
            }
        }

        if (firstDivergence === -1) {
            console.log('\n✓ BTC holdings match perfectly throughout!');
        }

        // Check shutdown logic
        console.log('\nShutdown Comparison:');
        const psShutdown = priceSimResult.projections.find(p => p.isShutdown);
        const trShutdown = treasuryResult.projections.find(p => p.isShutdown);

        if (psShutdown && trShutdown) {
            console.log(`Price Sim shutdown day: ${psShutdown.dayIndex}`);
            console.log(`Treasury shutdown day: ${trShutdown.dayIndex}`);
            console.log(`Difference: ${Math.abs(psShutdown.dayIndex - trShutdown.dayIndex)} days`);
        }

        // Final values
        const psFinal = priceSimResult.projections[priceSimResult.projections.length - 1];
        const trFinal = treasuryResult.projections[treasuryResult.projections.length - 1];

        console.log('\nFinal State:');
        console.log(`Price Sim: ${psFinal.btcHeld.toFixed(6)} BTC = $${psFinal.portfolioValueUSD.toFixed(2)}`);
        console.log(`Treasury: ${trFinal.treasuryBTC.toFixed(6)} BTC = $${trFinal.treasuryUSD.toFixed(2)}`);
        console.log(`BTC Difference: ${Math.abs(psFinal.btcHeld - trFinal.treasuryBTC).toFixed(6)}`);
        console.log(`USD Difference: $${Math.abs(psFinal.portfolioValueUSD - trFinal.treasuryUSD).toFixed(2)}`);
    });
});
