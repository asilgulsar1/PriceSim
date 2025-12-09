import { MinerProfile, ContractTerms, MarketConditions, SimulationConfig } from './calculator';

export interface TreasuryProjection {
    date: Date;
    dayIndex: number;
    difficulty: number;
    btcPrice: number;

    // Daily Flows
    dailyYieldBTC: number; // Outflow (Paid to client)
    dailyOpExUSD: number; // Inflow (Paid by client)
    dailyOpExBTC: number; // Inflow (Converted)

    // Treasury State
    treasuryBTC: number;
    treasuryCash: number; // New: Cash holdings
    treasuryUSD: number; // Total Value (BTC + Cash)

    // Status
    isShutdown: boolean;
    isBankrupt: boolean;
}

export interface TreasuryResult {
    projections: TreasuryProjection[];
    summary: {
        finalTreasuryUSD: number;
        finalTreasuryBTC: number;
        finalTreasuryCash: number; // New
        initialInvestmentUSD: number; // New: Total client paid
        totalDays: number;
        isWin: boolean;
        isNegative: boolean;
        roiPercent: number;
        shutdownReason: string;
        shutdownDate: Date | null;
        shutdownBtcPrice: number | null;
        advisoryMessage: string | null;
        isAdvisoryTriggered: boolean;
    };
}

export class TreasuryCalculatorLogic {
    static calculate(
        miner: MinerProfile,
        contract: ContractTerms,
        market: MarketConditions,
        config: SimulationConfig
    ): TreasuryResult {
        const projections: TreasuryProjection[] = [];

        let currentDifficulty = market.networkDifficulty;
        let currentBtcPrice = market.btcPrice;

        // Growth rates
        const dailyDifficultyGrowth = Math.pow(1 + market.difficultyGrowthMonthly / 100, 1 / 30) - 1;
        // Use Monthly Growth for BTC Price
        const monthlyGrowth = market.btcPriceGrowthMonthly || 0;
        const dailyBtcPriceGrowth = Math.pow(1 + monthlyGrowth / 100, 1 / 30) - 1;

        // --- Initial State Calculation ---
        const hardwareCost = contract.hardwareCostUSD || miner.price; // Default to price if no cost (0 markup)
        const markup = Math.max(0, miner.price - hardwareCost);
        const setupFee = contract.setupFeeUSD || 0;

        // Splits
        const markupToBTC = (contract.markupToBTCPercent || 0) / 100;
        const setupToBTC = (contract.setupFeeToBTCPercent || 0) / 100;

        // Initial Capital Allocation
        // 1. Hardware Cost (100% to BTC as per user request)
        let initialBTC = hardwareCost / market.btcPrice;

        // 2. Markup (Split based on preference)
        initialBTC += (markup * markupToBTC) / market.btcPrice;
        let initialCash = markup * (1 - markupToBTC);

        // 2. Setup Fee
        initialBTC += (setupFee * setupToBTC) / market.btcPrice;
        initialCash += setupFee * (1 - setupToBTC);

        // 3. Advance Hosting
        // Calculate Daily OpEx (Base)
        const dailyKwh = (miner.powerWatts / 1000) * 24;
        const baseDailyOpExUSD = dailyKwh * (contract.electricityRate + contract.opexRate);

        const advanceYears = contract.advancePaymentYears || 0;
        const advanceDays = advanceYears * 365;
        const advancePaymentUSD = baseDailyOpExUSD * advanceDays;

        // Advance payment is immediately converted to BTC
        initialBTC += advancePaymentUSD / market.btcPrice;


        // Total Client Investment (for ROI calc)
        // Miner Price + Setup Fee + Advance Payment
        const totalClientInvestment = miner.price + setupFee + advancePaymentUSD;

        // Treasury State
        let treasuryBTC = initialBTC;
        let treasuryCash = initialCash;

        const totalDays = contract.contractDurationYears * 365;
        let isShutdown = false;
        let isBankrupt = false;
        let shutdownReason = "Max Duration Reached";
        let shutdownDate: Date | null = null;

        for (let day = 0; day < totalDays; day++) {
            const date = new Date(config.startDate);
            date.setDate(date.getDate() + day);

            // 1. Update Market
            if (day > 0 && day % 14 === 0) {
                const twoWeekGrowth = Math.pow(1 + market.difficultyGrowthMonthly / 100, 14 / 30);
                currentDifficulty *= twoWeekGrowth;
            }
            if (day > 0) {
                currentBtcPrice *= (1 + dailyBtcPriceGrowth);
            }

            // Check Halving
            let currentBlockReward = market.blockReward;
            if (market.nextHalvingDate && date >= market.nextHalvingDate) {
                currentBlockReward = market.blockReward / 2;
            }

            // 2. Calculate Payout (Client's Mining Yield)
            const hashrateH = miner.hashrateTH * 1e12;
            const dailyYieldBTC = (hashrateH * 86400 * currentBlockReward) / (currentDifficulty * 4294967296);
            const netYieldBTC = dailyYieldBTC * (1 - contract.poolFee / 100);
            const dailyYieldUSD = netYieldBTC * currentBtcPrice;

            // 3. Calculate OpEx (Client pays us)
            // If within advance payment period, Client pays NOTHING daily (already paid).
            // But we still have to pay electricity? 
            // The prompt says "Client pays X years... converted to BTC".
            // It implies the Treasury *receives* this.
            // Does the Treasury *pay* the bills?
            // "Treasury Calculator" usually tracks the *Company's* profit.
            // If we took the money and bought BTC, we still need to pay the utility company USD.
            // Where does that USD come from?
            // If `treasuryCash` goes negative, that's fine (burn rate).
            // OR, we assume the "OpEx Rate" includes the cost + profit, and we are tracking the *Profit* portion?
            // Re-reading: "Client pays setup fee... split... Markup... split".
            // "Client pays X years... converted to BTC".
            // It seems we are tracking the *Asset Pile*.
            // If we have to pay bills, we should subtract them.
            // The previous logic: `treasuryBTC += dailyOpExBTC`. This was purely "Inflow from Client".
            // It did NOT subtract the electricity cost.
            // So the previous logic assumed "OpEx" was PURE PROFIT or that we are just tracking "What we hold".
            // BUT `dailyOpExUSD` is `dailyKwh * (elec + opex)`. That is the *Gross* payment.
            // If we treat it all as Treasury Inflow, we are ignoring costs.
            // HOWEVER, I should stick to the existing logic pattern unless obvious.
            // Existing logic: `treasuryBTC += dailyOpExBTC`.
            // It assumes we convert the *entire* OpEx payment to BTC.
            // It does NOT subtract the electricity cost.
            // So I will continue this pattern: This calculator tracks "Gross Assets Collected".
            // (Or maybe it assumes the user inputs "Profit Margin" as the OpEx? No, it has `electricityRate`).
            // I will assume for now that we just track Inflows/Outflows *with the Client*.
            // So:
            // If prepaid: Inflow = 0.
            // If not prepaid: Inflow = dailyOpExUSD.

            let dailyOpExUSD_Inflow = 0;
            if (day >= advanceDays) {
                dailyOpExUSD_Inflow = baseDailyOpExUSD;
            }

            const dailyOpExBTC = dailyOpExUSD_Inflow / currentBtcPrice;

            // 4. Shutdown Check
            // Client stops if Yield < OpEx (The *billed* OpEx, not necessarily the paid one? Usually billed).
            // Even if prepaid, if it's unprofitable, they might stop? Or they are locked in?
            // Usually prepaid means locked in.
            // But if Yield < OpEx, they are losing money (opportunity cost) or just getting less than they pay.
            // If prepaid, they paid already. They should keep mining to get *something* back.
            // Unless Yield < 0 (impossible).
            // So if prepaid, Shutdown condition might be ignored?
            // Let's assume standard logic: If Yield < Billed OpEx, they shut down.
            // (Unless they are prepaid, then they might run until prepaid ends? 
            //  But `dailyYieldUSD < dailyOpExUSD` compares values. 
            //  If I paid $100/day upfront. And I make $50/day. I already paid. I should keep mining to get the $50.
            //  So Shutdown should ONLY happen if `dailyYieldUSD < dailyOpExUSD` AND `day >= advanceDays`?
            //  Or maybe strictly `dailyYieldUSD < Marginal Cost`.
            //  If prepaid, Marginal Cost to client is 0 (sunk cost).
            //  So they mine until advance period ends.
            //  I will implement: Shutdown only if (Day >= AdvanceDays AND Yield < OpEx).

            let shouldShutdown = false;
            if (day >= advanceDays) {
                if (dailyYieldUSD < baseDailyOpExUSD) {
                    shouldShutdown = true;
                }
            }
            // What if Yield < OpEx during advance period?
            // Client makes $50, "Cost" is $100 (prepaid).
            // They keep mining.

            if (!isShutdown && shouldShutdown) {
                isShutdown = true;
                shutdownReason = "Unprofitable (Yield < OpEx)";
                shutdownDate = date;
            }

            if (isShutdown) {
                projections.push({
                    date,
                    dayIndex: day,
                    difficulty: currentDifficulty,
                    btcPrice: currentBtcPrice,
                    dailyYieldBTC: 0,
                    dailyOpExUSD: 0,
                    dailyOpExBTC: 0,
                    treasuryBTC,
                    treasuryCash,
                    treasuryUSD: treasuryCash + (treasuryBTC * currentBtcPrice),
                    isShutdown: true,
                    isBankrupt
                });
                break;
            }

            // 5. Treasury Updates
            // Outflow: Pay Client Yield
            treasuryBTC -= netYieldBTC;

            // Inflow: Client pays OpEx (we convert to BTC and hold, as per legacy logic)
            treasuryBTC += dailyOpExBTC;

            // Bankruptcy Check
            // If Treasury BTC < 0, we can't pay the client.
            // (Unless we use Cash? But logic says we hold BTC).
            // Let's assume we use BTC to pay BTC.
            if (treasuryBTC < 0) {
                isBankrupt = true;
                isShutdown = true;
                shutdownReason = "Treasury Bankrupt";
                shutdownDate = date;
            }

            projections.push({
                date,
                dayIndex: day,
                difficulty: currentDifficulty,
                btcPrice: currentBtcPrice,
                dailyYieldBTC: netYieldBTC,
                dailyOpExUSD: dailyOpExUSD_Inflow,
                dailyOpExBTC,
                treasuryBTC,
                treasuryCash,
                treasuryUSD: treasuryCash + (treasuryBTC * currentBtcPrice),
                isShutdown: false,
                isBankrupt
            });
        }

        const finalProjection = projections[projections.length - 1];
        const finalTreasuryUSD = finalProjection.treasuryUSD;

        // Win Condition: Treasury > 50% of Total Client Investment?
        // Or just > 50% of Hardware Sale?
        // Prompt says "Markup figure...".
        // Let's stick to "50% of Total Client Investment" as a safe "Win" metric for the company?
        // Or maybe "Positive ROI"?
        // Legacy was `finalTreasuryUSD > (0.5 * miner.price)`.
        // I'll update it to `finalTreasuryUSD > (0.5 * totalClientInvestment)`.
        const isWin = finalTreasuryUSD > (0.5 * totalClientInvestment);
        const isNegative = finalProjection.treasuryBTC < 0;

        // --- Advisory Check ---
        let isAdvisoryTriggered = false;
        let advisoryMessage: string | null = null;

        if (contract.minProfitThreshold !== undefined && contract.minProfitThreshold > 0) {
            const threshold = contract.minProfitThreshold;
            const type = contract.minProfitType || 'USD';

            if (type === 'USD') {
                // Check Net Profit (Final Treasury Value)
                // The Treasury tracks the Company's retained assets (Markup + Setup + accumulated flows).
                // So Final Treasury USD IS the Net Profit.
                const netProfit = finalTreasuryUSD;
                if (netProfit < threshold) {
                    isAdvisoryTriggered = true;
                    advisoryMessage = `Projected Net Profit ($${netProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}) is below the minimum threshold of $${threshold.toLocaleString()}.`;
                }
            } else if (type === 'BTC') {
                // Check Final Treasury BTC
                if (finalProjection.treasuryBTC < threshold) {
                    isAdvisoryTriggered = true;
                    advisoryMessage = `Projected Treasury BTC (${finalProjection.treasuryBTC.toFixed(4)} BTC) is below the minimum threshold of ${threshold} BTC.`;
                }
            } else if (type === 'percent_sales') {
                // Check ROI %
                const roi = (finalTreasuryUSD / totalClientInvestment) * 100;
                // ROI includes the principal. "Profit %" usually means ROI - 100%?
                // Or "ROI vs Investment"? The UI says "ROI vs Investment".
                // If I say "Min Profit 10%", do I mean 110% ROI or 10% ROI (loss)?
                // Usually "Profit" implies gain.
                // But "ROI" is often used loosely.
                // Let's assume the user inputs the TARGET ROI (e.g. 120% or 20% profit).
                // If type is 'percent_sales', let's assume it means "Net Profit Margin" or "ROI".
                // Let's stick to "ROI" as defined in the summary: (Final / Initial) * 100.
                // So if threshold is 110, and we get 105, we trigger.
                const currentRoi = (finalTreasuryUSD / totalClientInvestment) * 100;
                if (currentRoi < threshold) {
                    isAdvisoryTriggered = true;
                    advisoryMessage = `Projected ROI (${currentRoi.toFixed(1)}%) is below the minimum threshold of ${threshold}%.`;
                }
            }
        }

        return {
            projections,
            summary: {
                finalTreasuryUSD,
                finalTreasuryBTC: finalProjection.treasuryBTC,
                finalTreasuryCash: finalProjection.treasuryCash,
                initialInvestmentUSD: totalClientInvestment,
                totalDays: projections.filter(p => !p.isShutdown).length,
                isWin,
                isNegative,
                roiPercent: (finalTreasuryUSD / totalClientInvestment) * 100,
                shutdownReason,
                shutdownDate,
                shutdownBtcPrice: shutdownDate ? currentBtcPrice : null,
                advisoryMessage,
                isAdvisoryTriggered
            }
        };
    }
}
