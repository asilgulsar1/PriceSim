
// Mock Interfaces to avoid import issues
interface MinerProfile {
    name: string;
    hashrateTH: number;
    powerWatts: number;
    price: number;
}
interface ContractTerms {
    electricityRate: number;
    opexRate: number;
    poolFee: number;
    contractDurationYears: number;
}
interface MarketConditions {
    btcPrice: number;
    networkDifficulty: number;
    blockReward: number;
    difficultyGrowthMonthly: number;
    btcPriceGrowthMonthly?: number;
    btcPriceGrowthAnnual: number;
    nextHalvingDate?: Date;
}
interface SimulationConfig {
    startDate: Date;
    initialInvestment: number;
    reinvestMode: 'hold' | 'sell_daily';
}
interface DailyProjection {
    date: Date;
    dayIndex: number;
    difficulty: number;
    btcPrice: number;
    blockReward: number;
    grossProductionBTC: number;
    poolFeeBTC: number;
    netProductionBTC: number;
    electricityCostUSD: number;
    opexCostUSD: number;
    totalDailyCostUSD: number;
    dailyRevenueUSD: number;
    dailyProfitUSD: number;
    cumulativeProductionBTC: number;
    cumulativeCostUSD: number;
    cumulativeRevenueUSD: number;
    cumulativeProfitUSD: number;
    btcHeld: number;
    cashBalance: number;
    portfolioValueUSD: number;
    isBreakeven: boolean;
    isShutdown: boolean;
}
interface SimulationResult {
    projections: DailyProjection[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    summary: any;
}

/* eslint-disable */
import { calculateDailyGrossBTC } from './mining-math';

// Inlined PriceSimulatorCalculator
class PriceSimulatorCalculator {
    static calculate(
        miner: MinerProfile,
        contract: ContractTerms,
        market: MarketConditions,
        config: SimulationConfig
    ): SimulationResult {
        const projections: DailyProjection[] = [];
        let currentDifficulty = market.networkDifficulty;
        let currentBtcPrice = market.btcPrice;

        const dailyDifficultyGrowth = Math.pow(1 + market.difficultyGrowthMonthly / 100, 1 / 30) - 1;
        const monthlyBtcGrowth = market.btcPriceGrowthMonthly ?? (market.btcPriceGrowthAnnual / 12);
        const dailyBtcPriceGrowth = Math.pow(1 + monthlyBtcGrowth / 100, 1 / 30) - 1;

        let cumulativeProductionBTC = 0;
        let cumulativeCostUSD = 0;
        let cumulativeRevenueUSD = 0;

        let btcHeld = 0;
        let cashBalance = 0;

        let breakevenDate: Date | null = null;
        let shutdownDate: Date | null = null;
        let isShutdown = false;

        const totalDays = contract.contractDurationYears * 365;

        for (let day = 0; day < totalDays; day++) {
            const date = new Date(config.startDate);
            date.setDate(date.getDate() + day);

            if (day > 0 && day % 14 === 0) {
                const twoWeekGrowth = Math.pow(1 + market.difficultyGrowthMonthly / 100, 14 / 30);
                currentDifficulty *= twoWeekGrowth;
            }

            if (day > 0) {
                currentBtcPrice *= (1 + dailyBtcPriceGrowth);
            }

            let currentBlockReward = market.blockReward;
            if (market.nextHalvingDate && date >= market.nextHalvingDate) {
                currentBlockReward = market.blockReward / 2;
            }

            // 3. Calculate Production
            const difficulty = currentDifficulty; // Keep difficulty variable for clarity
            const grossProductionBTC = calculateDailyGrossBTC(miner.hashrateTH, difficulty, currentBlockReward);

            const poolFeeBTC = grossProductionBTC * (contract.poolFee / 100);
            const netProductionBTC = grossProductionBTC - poolFeeBTC;

            const dailyKwh = (miner.powerWatts / 1000) * 24;
            const electricityCostUSD = dailyKwh * contract.electricityRate;
            const opexCostUSD = dailyKwh * contract.opexRate;
            const totalDailyCostUSD = electricityCostUSD + opexCostUSD;

            const dailyRevenueUSD = netProductionBTC * currentBtcPrice;
            const dailyProfitUSD = dailyRevenueUSD - totalDailyCostUSD;

            if (!isShutdown && dailyRevenueUSD < totalDailyCostUSD) {
                isShutdown = true;
                shutdownDate = date;
                console.log(`[DEBUG] Shutdown Triggered on Day ${day} (${date.toISOString().split('T')[0]})`);
                console.log(`  Revenue: $${dailyRevenueUSD.toFixed(4)} < Cost: $${totalDailyCostUSD.toFixed(4)}`);
                console.log(`  Reward: ${currentBlockReward}`);
                console.log(`  Prod: ${netProductionBTC.toFixed(6)}`);
            }

            if (day === 0) {
                cashBalance = config.initialInvestment;
                btcHeld = 0;
            }

            if (isShutdown) {
                const impliedBTC = cashBalance / currentBtcPrice;
                projections.push({
                    date,
                    dayIndex: day,
                    difficulty: currentDifficulty,
                    btcPrice: currentBtcPrice,
                    blockReward: currentBlockReward,
                    grossProductionBTC: 0,
                    poolFeeBTC: 0,
                    netProductionBTC: 0,
                    electricityCostUSD: 0,
                    opexCostUSD: 0,
                    totalDailyCostUSD: 0,
                    dailyRevenueUSD: 0,
                    dailyProfitUSD: 0,
                    cumulativeProductionBTC,
                    cumulativeCostUSD,
                    cumulativeRevenueUSD,
                    cumulativeProfitUSD: cumulativeRevenueUSD - cumulativeCostUSD - config.initialInvestment,
                    btcHeld: impliedBTC,
                    cashBalance,
                    portfolioValueUSD: cashBalance,
                    isBreakeven: !!breakevenDate,
                    isShutdown: true
                });
                continue;
            }

            cumulativeProductionBTC += netProductionBTC;
            cumulativeCostUSD += totalDailyCostUSD;
            cumulativeRevenueUSD += dailyRevenueUSD;

            const netChangeUSD = totalDailyCostUSD - dailyRevenueUSD;
            cashBalance += netChangeUSD;

            const impliedBTC = cashBalance / currentBtcPrice;
            btcHeld = impliedBTC;

            const portfolioValueUSD = cashBalance;

            if (!breakevenDate && portfolioValueUSD >= config.initialInvestment) {
                breakevenDate = date;
            }

            projections.push({
                date,
                dayIndex: day,
                difficulty: currentDifficulty,
                btcPrice: currentBtcPrice,
                blockReward: currentBlockReward,
                grossProductionBTC,
                poolFeeBTC,
                netProductionBTC,
                electricityCostUSD,
                opexCostUSD,
                totalDailyCostUSD,
                dailyRevenueUSD,
                dailyProfitUSD,
                cumulativeProductionBTC,
                cumulativeCostUSD,
                cumulativeRevenueUSD,
                cumulativeProfitUSD: portfolioValueUSD,
                btcHeld,
                cashBalance,
                portfolioValueUSD,
                isBreakeven: !!breakevenDate,
                isShutdown: false
            });
        }

        const finalProjection = projections[projections.length - 1];
        return {
            projections,
            summary: {
                totalDays: projections.filter(p => !p.isShutdown).length,
                totalProductionBTC: cumulativeProductionBTC,
                totalCostUSD: cumulativeCostUSD,
                totalRevenueUSD: cumulativeRevenueUSD,
                netProfitUSD: finalProjection.portfolioValueUSD,
                roiPercent: (finalProjection.portfolioValueUSD / config.initialInvestment) * 100,
                breakevenDate,
                shutdownDate,
                finalPortfolioValueUSD: finalProjection.portfolioValueUSD
            }
        };
    }
}

// Test Case
const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);

const mockMiner: MinerProfile = {
    name: 'Test - S21 XP Like',
    hashrateTH: 270,
    powerWatts: 3645,
    price: 6000
};

// Use somewhat realistic inputs
const mockContract: ContractTerms = {
    electricityRate: 0.06,
    opexRate: 0,
    poolFee: 1,
    contractDurationYears: 1
};

const mockMarket: MarketConditions = {
    btcPrice: 65000,
    networkDifficulty: 90000000000000, // 90T
    blockReward: 3.125,
    difficultyGrowthMonthly: 0,
    btcPriceGrowthMonthly: 0,
    btcPriceGrowthAnnual: 0,
    nextHalvingDate: tomorrow
};

const config: SimulationConfig = {
    startDate: today,
    initialInvestment: 6000,
    reinvestMode: 'hold'
};

console.log("--- Running Halving Debug ---");
// Day 0: Normal. Day 1: Halving.
const result = PriceSimulatorCalculator.calculate(mockMiner, mockContract, mockMarket, config);

result.projections.slice(0, 4).forEach(p => {
    console.log(`Day ${p.dayIndex} (${p.date.toISOString().split('T')[0]}):`);
    console.log(`  Reward: ${p.blockReward}`);
    console.log(`  Prod: ${p.netProductionBTC.toFixed(6)}`);
    console.log(`  Rev: $${p.dailyRevenueUSD.toFixed(2)}`);
    console.log(`  Cost: $${p.totalDailyCostUSD.toFixed(2)}`);
    console.log(`  Shutdown? ${p.isShutdown}`);
});
