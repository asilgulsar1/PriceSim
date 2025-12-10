import { SolvedMiner } from './pricing-solver';
import { getMinerReleaseYear } from './miner-data';

export interface MinerScoreDetail {
    miner: SolvedMiner;
    score: number;
    metrics: {
        profitabilityScore: number; // 0-100 (weighted 30)
        revenueScore: number;      // 0-100 (weighted 30)
        ageScore: number;          // 0-100 (weighted 20)
        efficiencyScore: number;   // 0-100 (weighted 20)
    };
    raw: {
        profitability: number;
        revenue: number;
        year: number;
        efficiency: number;
    }
}

export function rankMiners(miners: SolvedMiner[]): MinerScoreDetail[] {
    if (miners.length === 0) return [];

    // 1. Extract raw values to find min/max for normalization
    const extracted = miners.map(m => {
        // Calculate daily profit manually if not present, but SolvedMiner has dailyRevenueUSD and dailyExpenseUSD
        // Actually, user asked for "Profitability %" (ROI) and "Daily Revenue $"
        // "Profitability %" is `clientProfitabilityPercent`

        return {
            miner: m,
            profitability: m.clientProfitabilityPercent,
            revenue: m.dailyRevenueUSD,
            year: getMinerReleaseYear(m.name),
            efficiency: m.powerWatts / m.hashrateTH
        };
    });

    const maxProfit = Math.max(...extracted.map(x => x.profitability), 1);
    const minProfit = Math.min(...extracted.map(x => x.profitability), 0);

    const maxRev = Math.max(...extracted.map(x => x.revenue), 1);
    const minRev = Math.min(...extracted.map(x => x.revenue), 0);

    const maxYear = Math.max(...extracted.map(x => x.year), 2025);
    const minYear = Math.min(...extracted.map(x => x.year), 2020);

    // Efficiency: Lower is better. So Max Score = Min Eff.
    const maxEff = Math.max(...extracted.map(x => x.efficiency), 30);
    const minEff = Math.min(...extracted.map(x => x.efficiency), 10);

    // 2. Score
    return extracted.map(item => {
        // Normalize 0-1
        // Profit: Higher is better
        const normProfit = maxProfit === minProfit ? 1 : (item.profitability - minProfit) / (maxProfit - minProfit);

        // Rev: Higher is better
        const normRev = maxRev === minRev ? 1 : (item.revenue - minRev) / (maxRev - minRev);

        // Age: Newer is better
        const normAge = maxYear === minYear ? 1 : (item.year - minYear) / (maxYear - minYear);

        // Eff: Lower is better (Reverse)
        const normEff = maxEff === minEff ? 1 : (maxEff - item.efficiency) / (maxEff - minEff);

        // Weights
        // Profit: 30
        // Rev: 30
        // Age: 20
        // Eff: 20

        const pScore = normProfit * 30;
        const rScore = normRev * 30;
        const aScore = normAge * 20;
        const eScore = normEff * 20;

        const totalScore = pScore + rScore + aScore + eScore;

        return {
            miner: item.miner,
            score: totalScore,
            metrics: {
                profitabilityScore: pScore,
                revenueScore: rScore,
                ageScore: aScore,
                efficiencyScore: eScore
            },
            raw: {
                profitability: item.profitability,
                revenue: item.revenue,
                year: item.year,
                efficiency: item.efficiency
            }
        };
    }).sort((a, b) => b.score - a.score);
}
