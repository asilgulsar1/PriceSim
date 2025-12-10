import { PriceSimulatorCalculator, MinerProfile, ContractTerms, MarketConditions, SimulationConfig, DailyProjection } from './price-simulator-calculator';

export interface SolvedMiner extends MinerProfile {
    calculatedPrice: number;
    projectLifeDays: number;
    totalRevenueUSD: number;
    totalCostUSD: number;
    estExpenseBTC: number;
    estRevenueHostingBTC: number;
    finalTreasuryBTC: number;
    finalTreasuryUSD: number;
    projections: DailyProjection[];
    roiPercent: number;
    targetMet: boolean;
    clientProfitabilityPercent: number;
    dailyRevenueUSD: number;
    dailyExpenseUSD: number;
}

/**
 * Solves for the miner price that achieves the target profit margin.
 */
export function solveMinerPrice(
    miner: MinerProfile,
    contract: ContractTerms,
    market: MarketConditions,
    targetProfitPercent: number,
    isBtcTarget: boolean
): SolvedMiner {
    // PASS 1: Run Simulation with Miner Price (Hardware Cost) - to get base metrics M and H
    const configPass1: SimulationConfig = {
        startDate: new Date(),
        initialInvestment: miner.price,
        reinvestMode: 'hold'
    };

    const resPass1 = PriceSimulatorCalculator.calculate(miner, contract, market, configPass1);
    const totalProductionBTC = resPass1.summary.totalProductionBTC;

    // Calculate Metrics
    const M = totalProductionBTC;

    // Calculate H_btc (Sum of daily hosting / daily price)
    let H_btc_sum = 0;
    resPass1.projections.forEach(day => {
        if (!day.isShutdown) {
            H_btc_sum += day.totalDailyCostUSD / day.btcPrice;
        }
    });

    const estExpenseBTC = M;
    const estRevenueHostingBTC = H_btc_sum;

    // Calculate Sales Price (X)
    const targetMargin = targetProfitPercent / 100;
    let calculatedPrice = 0;

    if (isBtcTarget) {
        // BTC Basis Calculation
        if (targetMargin >= 1) {
            calculatedPrice = 0;
        } else {
            const P_btc = (M - H_btc_sum) / (1 - targetMargin);
            calculatedPrice = P_btc * market.btcPrice;
        }
    } else {
        // USD Basis Calculation with BTC Appreciation
        const shutdownDay = resPass1.projections.find(p => p.isShutdown) || resPass1.projections[resPass1.projections.length - 1];
        const finalBtcPrice = shutdownDay.btcPrice;
        const initialBtcPrice = market.btcPrice;

        let netBtcFlow = 0;
        resPass1.projections.forEach(day => {
            if (!day.isShutdown) {
                const hostingFeeBTC = day.totalDailyCostUSD / day.btcPrice;
                netBtcFlow += (hostingFeeBTC - day.netProductionBTC);
            }
        });

        if (targetMargin >= 1) {
            calculatedPrice = 0;
        } else {
            const priceRatio = finalBtcPrice / initialBtcPrice;
            const denominator = priceRatio - targetMargin;

            if (Math.abs(denominator) < 0.001) {
                calculatedPrice = 0;
            } else {
                calculatedPrice = (-netBtcFlow * finalBtcPrice) / denominator;
            }
        }
    }

    if (!isFinite(calculatedPrice) || isNaN(calculatedPrice)) {
        calculatedPrice = 0;
    }

    // PASS 2: Re-run with Calculated Price
    const configPass2: SimulationConfig = {
        startDate: new Date(),
        initialInvestment: calculatedPrice > 0 ? calculatedPrice : miner.price,
        reinvestMode: 'hold'
    };

    const resFinal = PriceSimulatorCalculator.calculate(miner, contract, market, configPass2);

    let finalTreasuryBTC = 0;
    let finalTreasuryUSD = 0;

    if (calculatedPrice > 0) {
        let targetDay = resFinal.projections[resFinal.projections.length - 1];
        const shutdownDay = resFinal.projections.find(p => p.isShutdown);
        if (shutdownDay) {
            targetDay = shutdownDay;
        }
        finalTreasuryBTC = targetDay.btcHeld;
        finalTreasuryUSD = targetDay.portfolioValueUSD;
    }

    const day1Revenue = resFinal.projections.length > 0 ? resFinal.projections[0].dailyRevenueUSD : 0;
    const day1Expense = resFinal.projections.length > 0 ? resFinal.projections[0].totalDailyCostUSD : 0;

    // Annualize the simplified return metric: (Day 1 Revenue * 365) / Price
    const clientProfitabilityPercent = calculatedPrice > 0 ? ((day1Revenue * 365) / calculatedPrice) * 100 : 0;

    return {
        ...miner,
        calculatedPrice,
        projectLifeDays: resFinal.summary.totalDays,
        totalRevenueUSD: resFinal.summary.totalRevenueUSD,
        totalCostUSD: resFinal.summary.totalCostUSD,
        estExpenseBTC,
        estRevenueHostingBTC,
        finalTreasuryBTC,
        finalTreasuryUSD,
        projections: resFinal.projections,
        roiPercent: targetProfitPercent,
        targetMet: calculatedPrice > 0,
        clientProfitabilityPercent,
        dailyRevenueUSD: day1Revenue,
        dailyExpenseUSD: day1Expense
    };
}
