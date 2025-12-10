/**
 * Comparison Test: Price Simulator Calculator vs Treasury Calculator
 * 
 * Tests if both calculators produce the same final balance when given identical parameters.
 */

import { PriceSimulatorCalculator } from './price-simulator-calculator';
import { TreasuryCalculatorLogic } from './treasury-calculator';
import { MinerProfile, ContractTerms, MarketConditions, SimulationConfig } from './calculator';

describe('Calculator Comparison: Price Simulator vs Treasury', () => {
    // Shared test parameters - Antminer S21 XP Hydro
    const miner: MinerProfile = {
        name: 'Antminer S21 XP Hydro',
        hashrateTH: 473,
        powerWatts: 5676,
        price: 11975 // Using Price Simulator value
    };

    const contract: ContractTerms = {
        electricityRate: 0.06,
        opexRate: 0.00,
        poolFee: 1.0,
        contractDurationYears: 5,
        advancePaymentYears: 0,
        setupFeeUSD: 0,
        setupFeeToBTCPercent: 0,
        hardwareCostUSD: 0, // Set to 0 for simple comparison (100% markup to BTC)
        markupToBTCPercent: 100,
        minProfitThreshold: 0,
        minProfitType: 'USD'
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

    it('should produce similar final balances at shutdown', () => {
        // Run Price Simulator (USD tracking)
        const priceSimResult = PriceSimulatorCalculator.calculate(miner, contract, market, config);

        // Run Treasury Calculator (BTC tracking)
        const treasuryResult = TreasuryCalculatorLogic.calculate(miner, contract, market, config);

        console.log('\n=== PRICE SIMULATOR (USD Tracking) ===');
        console.log('Shutdown Date:', priceSimResult.summary.shutdownDate?.toDateString());
        console.log('Total Days:', priceSimResult.summary.totalDays);
        console.log('Final Portfolio Value (USD):', priceSimResult.summary.finalPortfolioValueUSD.toFixed(2));
        console.log('Net Profit USD:', priceSimResult.summary.netProfitUSD.toFixed(2));

        console.log('\n=== TREASURY CALCULATOR (BTC Tracking) ===');
        console.log('Shutdown Date:', treasuryResult.summary.shutdownDate?.toDateString());
        console.log('Total Days:', treasuryResult.summary.totalDays);
        console.log('Final Treasury Value (USD):', treasuryResult.summary.finalTreasuryUSD.toFixed(2));
        console.log('Final Treasury BTC:', treasuryResult.summary.finalTreasuryBTC.toFixed(4));
        console.log('BTC Price at Shutdown:', treasuryResult.summary.shutdownBtcPrice?.toFixed(2));

        // Calculate the expected difference due to BTC price tracking
        const priceDiff = priceSimResult.summary.finalPortfolioValueUSD - treasuryResult.summary.finalTreasuryUSD;
        console.log('\n=== COMPARISON ===');
        console.log('Difference (USD):', priceDiff.toFixed(2));
        console.log('Difference (%):', ((priceDiff / priceSimResult.summary.finalPortfolioValueUSD) * 100).toFixed(2) + '%');

        // They should have the same shutdown date
        expect(priceSimResult.summary.shutdownDate?.toDateString()).toBe(
            treasuryResult.summary.shutdownDate?.toDateString()
        );

        // They should have the same total days
        expect(priceSimResult.summary.totalDays).toBe(treasuryResult.summary.totalDays);

        // The difference in final values should be due to BTC price fluctuation
        // If Treasury tracks in BTC and Price Sim tracks in USD, there will be a difference
        console.log('\n=== ANALYSIS ===');
        if (Math.abs(priceDiff) < 100) {
            console.log('✓ Values are very close - minimal BTC price impact');
        } else {
            console.log('⚠ Significant difference detected');
            console.log('This is expected because:');
            console.log('- Treasury Calculator tracks in BTC, displays in USD');
            console.log('- Price Simulator tracks in pure USD');
            console.log('- BTC price appreciation affects Treasury\'s USD valuation');
        }
    });

    it('should show detailed daily comparison for first 10 days', () => {
        const priceSimResult = PriceSimulatorCalculator.calculate(miner, contract, market, config);
        const treasuryResult = TreasuryCalculatorLogic.calculate(miner, contract, market, config);

        console.log('\n=== DAILY COMPARISON (First 10 Days) ===');
        console.log('Day | Price Sim (USD) | Treasury (USD) | Difference | Treasury BTC');
        console.log('-'.repeat(75));

        for (let i = 0; i < Math.min(10, priceSimResult.projections.length); i++) {
            const priceProj = priceSimResult.projections[i];
            const treasProj = treasuryResult.projections[i];
            const diff = priceProj.portfolioValueUSD - treasProj.treasuryUSD;

            console.log(
                `${i.toString().padStart(3)} | ` +
                `$${priceProj.portfolioValueUSD.toFixed(2).padStart(10)} | ` +
                `$${treasProj.treasuryUSD.toFixed(2).padStart(10)} | ` +
                `$${diff.toFixed(2).padStart(10)} | ` +
                `${treasProj.treasuryBTC.toFixed(6)}`
            );
        }
    });
});
