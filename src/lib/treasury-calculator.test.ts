import { TreasuryCalculatorLogic } from './treasury-calculator';
import { MinerProfile, ContractTerms, MarketConditions, SimulationConfig } from './calculator';

describe('TreasuryCalculatorLogic Advisory System', () => {
    const defaultMiner: MinerProfile = {
        name: 'Test Miner',
        hashrateTH: 100,
        powerWatts: 3000,
        price: 5000
    };

    const defaultContract: ContractTerms = {
        electricityRate: 0.05,
        opexRate: 0,
        poolFee: 1,
        contractDurationYears: 1, // Short duration for test
        hardwareCostUSD: 4000,
        markupToBTCPercent: 100
    };

    const defaultMarket: MarketConditions = {
        btcPrice: 50000,
        networkDifficulty: 50000000000000,
        blockReward: 3.125,
        difficultyGrowthMonthly: 0,
        btcPriceGrowthMonthly: 0,
        btcPriceGrowthAnnual: 0
    };

    const defaultConfig: SimulationConfig = {
        startDate: new Date(),
        initialInvestment: 5000,
        reinvestMode: 'hold'
    };

    test('should trigger advisory when Net Profit USD is below threshold', () => {
        const contract = { ...defaultContract, minProfitThreshold: 1000000, minProfitType: 'USD' as const };
        const result = TreasuryCalculatorLogic.calculate(defaultMiner, contract, defaultMarket, defaultConfig);

        expect(result.summary.isAdvisoryTriggered).toBe(true);
        expect(result.summary.advisoryMessage).toContain('below the minimum threshold');
    });

    test('should NOT trigger advisory when Net Profit USD is above threshold', () => {
        const contract = { ...defaultContract, minProfitThreshold: 10, minProfitType: 'USD' as const };
        const result = TreasuryCalculatorLogic.calculate(defaultMiner, contract, defaultMarket, defaultConfig);

        // Assuming the miner makes > $100 profit in a year
        expect(result.summary.isAdvisoryTriggered).toBe(false);
        expect(result.summary.advisoryMessage).toBeNull();
    });

    test('should trigger advisory when Treasury BTC is below threshold', () => {
        const contract = { ...defaultContract, minProfitThreshold: 100, minProfitType: 'BTC' as const };
        const result = TreasuryCalculatorLogic.calculate(defaultMiner, contract, defaultMarket, defaultConfig);

        expect(result.summary.isAdvisoryTriggered).toBe(true);
        expect(result.summary.advisoryMessage).toContain('BTC');
    });

    test('should trigger advisory when ROI % is below threshold', () => {
        const contract = { ...defaultContract, minProfitThreshold: 500, minProfitType: 'percent_sales' as const };
        const result = TreasuryCalculatorLogic.calculate(defaultMiner, contract, defaultMarket, defaultConfig);

        expect(result.summary.isAdvisoryTriggered).toBe(true);
        expect(result.summary.advisoryMessage).toContain('ROI');
    });

    test('should include hardware cost in initial BTC treasury', () => {
        // Price 5000, HW Cost 4000, Markup 1000.
        // Markup 100% to BTC.
        // Initial BTC should be (4000 + 1000) / 50000 = 0.1 BTC.
        // Plus setup fee (0).
        // Plus advance payment (0).
        const contract = { ...defaultContract, hardwareCostUSD: 4000, markupToBTCPercent: 100 };
        const result = TreasuryCalculatorLogic.calculate(defaultMiner, contract, defaultMarket, defaultConfig);

        // Check the first projection (day 0)
        const firstDay = result.projections[0];
        // It pays out some yield on day 0? No, usually day 0 is start.
        // The logic loop starts at day 0.
        // treasuryBTC starts at initialBTC.
        // Then subtracts yield, adds OpEx.
        // Let's check the logic:
        // treasuryBTC -= netYieldBTC;
        // treasuryBTC += dailyOpExBTC;

        // So final treasuryBTC on day 0 will be slightly different.
        // But we can check if it's CLOSE to 0.1.
        // Yield for 1 day is small.

        // Let's calculate expected initial BTC exactly.
        const expectedInitial = (4000 + 1000) / 50000; // 0.1

        // We can't easily access "initialBTC" variable from outside, but we can infer it from day 0 or summary.
        // If we set duration to 0? Loop runs 0 times?
        // Loop runs `totalDays`. If duration is 1 year, it runs.

        // Let's just check if it's roughly 0.1.
        // Previous logic would have been only Markup (1000/50000 = 0.02).
        // So 0.1 vs 0.02 is a big difference.

        expect(firstDay.treasuryBTC).toBeGreaterThan(0.09);
    });

    test('should add daily hosting payment to treasury (OpEx Inflow)', () => {
        // Verify that Treasury Change = OpEx Inflow - Yield Outflow
        // Set low electricity rate and high BTC price to ensure it doesn't shutdown immediately
        const contract = { ...defaultContract, electricityRate: 0.01, opexRate: 0, poolFee: 0, advancePaymentYears: 0 };
        const market = { ...defaultMarket, btcPrice: 100000 };
        const result = TreasuryCalculatorLogic.calculate(defaultMiner, contract, market, defaultConfig);

        const day0 = result.projections[0];
        const day1 = result.projections[1];

        // Ensure we have some OpEx
        expect(day1.dailyOpExBTC).toBeGreaterThan(0);

        // Calculate expected change for Day 1
        // Day 1 Balance = Day 0 Balance + Day 1 OpEx - Day 1 Yield
        const expectedBalance = day0.treasuryBTC + day1.dailyOpExBTC - day1.dailyYieldBTC;

        expect(day1.treasuryBTC).toBeCloseTo(expectedBalance, 8);
    });

    test('handles advance payment correctly', () => {
        // 1 Year Advance
        const contract = { ...defaultContract, advancePaymentYears: 1 };
        const result = TreasuryCalculatorLogic.calculate(defaultMiner, contract, defaultMarket, defaultConfig);

        // Initial BTC should include the advance payment
        // Advance = 1 year * 365 * dailyOpExUSD
        // dailyOpExUSD = (3000/1000 * 24) * 0.05 = 3.6 USD/day
        // Advance = 3.6 * 365 = 1314 USD
        // Converted to BTC @ 50000 = 0.02628 BTC

        // Base Initial BTC (Hardware Cost 4000 + Markup 1000) = 5000 / 50000 = 0.1 BTC
        // Total Initial BTC should be approx 0.12628

        const firstDay = result.projections[0];
        expect(firstDay.treasuryBTC).toBeGreaterThan(0.12);

        // Daily OpEx Inflow should be 0 during the first year
        expect(result.projections[10].dailyOpExUSD).toBe(0);
        expect(result.projections[10].dailyOpExBTC).toBe(0);
    });

    test('handles setup fee split correctly', () => {
        // Setup Fee 1000, 50% to BTC
        const contract = { ...defaultContract, setupFeeUSD: 1000, setupFeeToBTCPercent: 50 };
        const result = TreasuryCalculatorLogic.calculate(defaultMiner, contract, defaultMarket, defaultConfig);

        // Initial Cash should include 50% of Setup Fee (500) + Markup Cash Portion (0 in default)
        // Default Markup is 1000 (5000 price - 4000 cost). Default markupToBTC is 100%.
        // So Cash = 500.

        const firstDay = result.projections[0];
        expect(firstDay.treasuryCash).toBeCloseTo(500, 0);

        // Initial BTC should include 50% of Setup Fee (500/50000 = 0.01) + Hardware (4000/50000=0.08) + Markup (1000/50000=0.02)
        // Total BTC = 0.11
        // (Note: previous test logic for hardware cost was slightly simplified, let's trust the logic)
        // Hardware Cost 4000 -> 0.08 BTC
        // Markup 1000 -> 0.02 BTC
        // Setup 500 -> 0.01 BTC
        // Total 0.11 BTC

        // We need to account for the first day's yield/opex change, but it should be close.
        expect(firstDay.treasuryBTC).toBeCloseTo(0.11, 2);
    });

    test('handles markup split correctly', () => {
        // Markup 1000. 50% to BTC.
        const contract = { ...defaultContract, markupToBTCPercent: 50 };
        const result = TreasuryCalculatorLogic.calculate(defaultMiner, contract, defaultMarket, defaultConfig);

        // Cash should be 50% of Markup (500)
        const firstDay = result.projections[0];
        expect(firstDay.treasuryCash).toBeCloseTo(500, 0);

        // BTC should be Hardware (4000/50000=0.08) + 50% Markup (500/50000=0.01) = 0.09
        expect(firstDay.treasuryBTC).toBeCloseTo(0.09, 2);
    });

    test('detects bankruptcy', () => {
        // Force bankruptcy by having high yield outflow and no inflow (advance payment 0, but maybe low opex?)
        // Or just high pool fee?
        // If we pay out more BTC than we have.
        // Initial BTC is finite. Yield is continuous.
        // Eventually we run out if we don't get enough OpEx inflow?
        // Actually, OpEx inflow is usually < Yield value? No, OpEx is cost. Yield is revenue.
        // If Yield > OpEx, Client makes money.
        // Treasury pays Yield (Outflow) and receives OpEx (Inflow).
        // If Yield > OpEx (in BTC terms), Treasury loses BTC over time.
        // So a profitable miner for the client is a drain on the Treasury's BTC stack?
        // YES. That's the model. The Treasury "sells" the miner and "hosts" it.
        // It takes the upfront cash/BTC.
        // It pays out the mining yield.
        // It collects electricity fees.
        // If the miner is very productive, the Treasury pays out a lot.

        // So to bankrupt: High Hashrate, Low OpEx Payment.
        const superMiner = { ...defaultMiner, hashrateTH: 10000 }; // Huge hashrate
        const contract = { ...defaultContract, electricityRate: 0 }; // No inflow

        const result = TreasuryCalculatorLogic.calculate(superMiner, contract, defaultMarket, defaultConfig);

        expect(result.summary.isNegative).toBe(true);
        // It might not trigger "isBankrupt" flag if the logic only checks at the end?
        // Logic checks `if (treasuryBTC < 0) { isBankrupt = true; }` inside the loop.

        // Let's check if it actually triggered bankruptcy
        const bankruptDay = result.projections.find(p => p.isBankrupt);
        expect(bankruptDay).toBeDefined();
    });

    test('detects win condition', () => {
        // Win: Final Treasury > 50% of Total Client Investment
        // Client Investment = 5000. Target > 2500.
        // If we have high OpEx inflow and low Yield outflow (unprofitable miner for client?)
        // Or just high initial markup.
        // Let's try high markup.
        // Price 10000, Hardware Cost 1000. Markup 9000.
        // Initial Treasury ~ 10000 USD value.
        // Client Investment 10000.
        // 10000 > 5000. Win.

        const highMarkupMiner = { ...defaultMiner, price: 10000 };
        const contract = { ...defaultContract, hardwareCostUSD: 1000 };

        const result = TreasuryCalculatorLogic.calculate(highMarkupMiner, contract, defaultMarket, defaultConfig);

        expect(result.summary.isWin).toBe(true);
    });

    test('triggers shutdown when yield < opex', () => {
        // Client side shutdown.
        // High OpEx, Low Yield.
        const contract = { ...defaultContract, electricityRate: 1.0 }; // Very high cost
        const result = TreasuryCalculatorLogic.calculate(defaultMiner, contract, defaultMarket, defaultConfig);

        expect(result.summary.shutdownDate).not.toBeNull();
        expect(result.summary.shutdownReason).toContain('Unprofitable');
    });
});
