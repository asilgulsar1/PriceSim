/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { SimulationConfig, MinerProfile, ContractTerms, MarketConditions } from './calculator';

export interface FormulaLog {
    step: string;
    description: string;
    value: string;
    formula?: string;
}

export interface FormulaResult {
    minPrice: number; // USD or BTC depending on context, but usually we return the target currency value
    minPriceUSD: number;
    minPriceBTC: number;
    lifespanDays: number;
    totalRevenueBTC: number;
    totalCostBTC: number;
    logs: FormulaLog[];
    breakdown: {
        preHalvingDays: number;
        postHalvingDays: number;
        preHalvingRevenue: number;
        postHalvingRevenue: number;
    }
}

export class FormulaCalculator {
    static calculate(
        miner: MinerProfile,
        market: MarketConditions,
        contract: ContractTerms,
        isBtcBased: boolean
    ): FormulaResult {
        const logs: FormulaLog[] = [];
        const addLog = (step: string, desc: string, val: any, formula?: string) => {
            logs.push({
                step,
                description: desc,
                value: typeof val === 'number' ? val.toLocaleString(undefined, { maximumFractionDigits: 6 }) : String(val),
                formula
            });
        };

        addLog("1. Inputs", "Method", isBtcBased ? "BTC Based (No Price Growth applied to Cost)" : "USD Based (Price Growth reduces BTC Cost)");

        // 1. Prepare Data
        const difficulty = market.networkDifficulty;
        const network_hash_th = (difficulty * (2 ** 32) / 600) / 1e12;
        addLog("1. Data", "Network Hashrate (TH/s)", network_hash_th.toFixed(0), "(Difficulty * 2^32 / 600) / 1e12");

        // 2. Day 1 Fundamentals
        // Block Reward
        const currentReward = market.blockReward;

        // r0_btc: First day revenue
        const r0_btc = (miner.hashrateTH / network_hash_th) * 144 * currentReward;
        addLog("2. Fundamentals", "Day 1 Revenue (r0_btc)", r0_btc, "(Hashrate / NetHash) * 144 * Reward");

        // c0_btc: Day 1 cost in BTC
        // Cost is (Watts/1000 * 24 * Rate) / BTC_Price
        // Rate should include opex if applicable. Assuming electricityRate is all-in or sum them.
        const allInRate = contract.electricityRate + (contract.opexRate || 0);
        const dailyCostUSD = (miner.powerWatts / 1000) * 24 * allInRate;
        const c0_btc = dailyCostUSD / market.btcPrice;

        addLog("2. Fundamentals", "Day 1 Cost USD", dailyCostUSD.toFixed(2), "Power * 24 * Rate");
        addLog("2. Fundamentals", "Day 1 Cost BTC (c0_btc)", c0_btc, "DailyCostUSD / BTCPrice");

        if (r0_btc <= c0_btc) {
            addLog("Result", "Unprofitable", "Day 1 Cost > Revenue");
            return {
                minPrice: 0, minPriceUSD: 0, minPriceBTC: 0, lifespanDays: 0, totalRevenueBTC: 0, totalCostBTC: 0, logs,
                breakdown: { preHalvingDays: 0, postHalvingDays: 0, preHalvingRevenue: 0, postHalvingRevenue: 0 }
            };
        }

        // 3. Decay Factors
        // Difficulty Growth
        const diffGrowthMonthly = market.difficultyGrowthMonthly / 100;
        const diffGrowthDaily = Math.pow(1 + diffGrowthMonthly, 1 / 30) - 1;
        const decay_diff = 1 / (1 + diffGrowthDaily); // Revenue decays by this

        addLog("3. Decay", "Difficulty Growth Daily", (diffGrowthDaily * 100).toFixed(4) + "%", "From Monthly " + market.difficultyGrowthMonthly + "%");
        addLog("3. Decay", "Revenue Decay Factor (decay_diff)", decay_diff.toFixed(6), "1 / (1 + DiffGrowth)");

        // Price Growth (affects c_btc decay)
        let decay_cost = 1.0;
        let priceGrowthDaily = 0;
        if (!isBtcBased) {
            const priceGrowthMonthly = (market.btcPriceGrowthMonthly ?? 0) / 100;
            priceGrowthDaily = Math.pow(1 + priceGrowthMonthly, 1 / 30) - 1;
            decay_cost = 1 / (1 + priceGrowthDaily); // Cost in BTC decays by this (as Price goes up, Cost in BTC goes down)
            addLog("3. Decay", "Price Growth Daily", (priceGrowthDaily * 100).toFixed(4) + "%", "From Monthly " + market.btcPriceGrowthMonthly + "%");
            addLog("3. Decay", "Cost Decay Factor (decay_cost)", decay_cost.toFixed(6), "1 / (1 + PriceGrowth)");
        } else {
            addLog("3. Decay", "Cost Decay Factor", "1.0", "BTC Based Mode (Constant BTC Cost)");
        }

        // 4. Halving Check
        const today = new Date();
        const nextHalving = market.nextHalvingDate || new Date(today.getTime() + 4 * 365 * 24 * 3600 * 1000);
        const daysToHalving = Math.ceil((nextHalving.getTime() - today.getTime()) / (1000 * 3600 * 24));

        addLog("4. Halving", "Days to Halving", daysToHalving, nextHalving.toLocaleDateString());

        // Helper to solve T for r0 * d_r^T = c0 * d_c^T
        // r0/c0 = (d_c/d_r)^T
        // T = log(r0/c0) / log(d_c/d_r)
        const solveLifespan = (r: number, c: number) => {
            if (r <= c) return 0;
            const ratio = decay_cost / decay_diff;
            if (Math.abs(ratio - 1) < 0.0000001) {
                // If decays are identical, and r > c, it lasts forever? Or until max contract?
                // Realistically difficulty grows faster than price usually.
                // If diff growth < price growth, profitability INCREASES. 
                return 10000; // Cap at something high
            }
            // If ratio < 1 (Cost decays faster than Revenue? No. 
            // decay_diff is usually ~0.999 (Revenue drops). decay_cost is ~0.999 (Cost drops).
            // We need Diff Growth > Price Growth for miner to die eventually.
            // i.e., Revenue drops FASTER than Cost drops.
            // decay_diff < decay_cost. => ratio > 1.

            // log(r/c) is positive (r>c).
            // log(ratio) is positive (ratio > 1).
            return Math.log(r / c) / Math.log(ratio);
        };

        const maxContractDays = contract.contractDurationYears * 365;

        // 5. Calculate Lifespan Phase 1 (Pre-Halving)
        const theoreticalLifespan = solveLifespan(r0_btc, c0_btc);
        addLog("5. Lifespan", "Theoretical Lifespan (ignoring halving)", theoreticalLifespan.toFixed(1) + " days");

        let preHalvingDays = 0;
        let postHalvingDays = 0;
        let totalRevenue = 0;
        let totalCost = 0;

        // Geometric Sum Helper: a * (1 - r^n) / (1 - r)
        const geomSum = (a: number, r: number, n: number) => {
            if (Math.abs(r - 1) < 0.0000001) return a * n;
            return a * (1 - Math.pow(r, n)) / (1 - r);
        };

        if (theoreticalLifespan <= daysToHalving) {
            // Dies before halving
            preHalvingDays = Math.min(theoreticalLifespan, maxContractDays);
            totalRevenue = geomSum(r0_btc, decay_diff, preHalvingDays);
            totalCost = geomSum(c0_btc, decay_cost, preHalvingDays);

            addLog("Result", "Scenario", "Dies before Halving");
        } else {
            // Survives to Halving
            preHalvingDays = daysToHalving;
            const rev1 = geomSum(r0_btc, decay_diff, preHalvingDays);
            const cost1 = geomSum(c0_btc, decay_cost, preHalvingDays);

            // State at Halving
            // Revenue Base drops by 50%
            // But we must apply decay for the time passed
            const r_at_halving_pre_drop = r0_btc * Math.pow(decay_diff, preHalvingDays);
            const r_halving = r_at_halving_pre_drop * 0.5; // HALVING DROP

            const c_halving = c0_btc * Math.pow(decay_cost, preHalvingDays);

            addLog("5. Halving Event", "Revenue at Halving (Post-Drop)", r_halving.toFixed(6));
            addLog("5. Halving Event", "Cost at Halving", c_halving.toFixed(6));

            if (r_halving <= c_halving) {
                // Dies immediately at halving
                postHalvingDays = 0;
                totalRevenue = rev1;
                totalCost = cost1;
                addLog("Result", "Scenario", "Dies exactly at Halving");
            } else {
                // Continues after halving
                const lifespan2 = solveLifespan(r_halving, c_halving);
                addLog("6. Post-Halving", "Additional Lifespan", lifespan2.toFixed(1) + " days");

                // Cap total days
                const remainingContract = maxContractDays - preHalvingDays;
                postHalvingDays = Math.min(lifespan2, remainingContract);

                if (postHalvingDays > 0) {
                    const rev2 = geomSum(r_halving, decay_diff, postHalvingDays);
                    const cost2 = geomSum(c_halving, decay_cost, postHalvingDays);

                    totalRevenue = rev1 + rev2;
                    totalCost = cost1 + cost2;
                } else {
                    totalRevenue = rev1;
                    totalCost = cost1;
                }
            }
        }

        const effectiveDays = preHalvingDays + postHalvingDays;
        addLog("7. Totals", "Total Active Days", effectiveDays.toFixed(1));
        addLog("7. Totals", "Total Revenue BTC", totalRevenue.toFixed(4));
        addLog("7. Totals", "Total Cost BTC", totalCost.toFixed(4));

        // 7. Treasury Rule
        // Price = 2 * (Revenue - Cost)
        const profitBTC = totalRevenue - totalCost;
        if (profitBTC < 0) {
            // Should be covered by lifecycle check, but just in case
            addLog("Result", "Net Profit Negative", profitBTC.toFixed(4));
            return {
                minPrice: 0, minPriceUSD: 0, minPriceBTC: 0, lifespanDays: Math.floor(effectiveDays),
                totalRevenueBTC: totalRevenue, totalCostBTC: totalCost, logs,
                breakdown: { preHalvingDays, postHalvingDays, preHalvingRevenue: 0, postHalvingRevenue: 0 }
            };
        }

        const minPriceBTC = 2 * profitBTC;
        const minPriceUSD = minPriceBTC * market.btcPrice; // Convert at CURRENT price

        addLog("8. Pricing", "Profit BTC", profitBTC.toFixed(4), "Revenue - Cost");
        addLog("8. Pricing", "Rule: Price = 2 * Profit", minPriceBTC.toFixed(4) + " BTC");

        if (!isBtcBased) {
            addLog("8. Pricing", "Final USD Price", "$" + minPriceUSD.toLocaleString(), "PriceBTC * CurrentBTCPrice");
        }

        return {
            minPrice: isBtcBased ? minPriceBTC : minPriceUSD,
            minPriceUSD,
            minPriceBTC,
            lifespanDays: Math.floor(effectiveDays),
            totalRevenueBTC: totalRevenue,
            totalCostBTC: totalCost,
            logs,
            breakdown: {
                preHalvingDays,
                postHalvingDays,
                preHalvingRevenue: 0, // Not strictly needed for return unless UI wants splits
                postHalvingRevenue: 0
            }
        };
    }
}
