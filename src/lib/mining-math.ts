/**
 * Centralized Mining Math & Physics Constants
 * Source of truth for all Bitcoin production and revenue calculations.
 */

export const MINING_CONSTANTS = {
    SECONDS_PER_DAY: 86400,
    TWO_POW_32: 4294967296, // 2^32
    H_TH: 1e12,             // 1 Terahash
};

/**
 * Calculates the gross daily BTC production for a given hashrate.
 * Formula: (Hashrate * Seconds/Day * BlockReward) / (Difficulty * 2^32)
 * 
 * @param hashrateTH - Hashrate in Terahashes per second (TH/s)
 * @param difficulty - Current Network Difficulty
 * @param blockReward - Current Block Reward (e.g., 3.125)
 * @returns Gross BTC mined per day (before fees/costs)
 */
export function calculateDailyGrossBTC(hashrateTH: number, difficulty: number, blockReward: number): number {
    if (difficulty <= 0) return 0;
    const { SECONDS_PER_DAY, TWO_POW_32, H_TH } = MINING_CONSTANTS;

    // Convert TH/s to H/s
    const hashrateH = hashrateTH * H_TH;

    return (hashrateH * SECONDS_PER_DAY * blockReward) / (difficulty * TWO_POW_32);
}

/**
 * Calculates current Hashprice (Revenue per TH/s per Day).
 * 
 * @param difficulty - Current Network Difficulty
 * @param blockReward - Current Block Reward
 * @param btcPrice - Current Bitcoin Price in USD
 * @returns Hashprice in USD/TH/Day
 */
export function calculateHashpriceUSD(difficulty: number, blockReward: number, btcPrice: number): number {
    // Calculate for 1 TH/s
    const btcPerTH = calculateDailyGrossBTC(1, difficulty, blockReward);
    return btcPerTH * btcPrice;
}

/**
 * Calculates net daily revenue for a specific miner.
 * 
 * @param hashrateTH - Miner's hashrate
 * @param hashpriceUSD - Current Hashprice (USD/TH/Day)
 * @param poolFeePercent - Pool fee percentage (e.g., 1.0 for 1%)
 * @returns Net Daily USD Revenue
 */
export function calculateMinerRevenueUSD(hashrateTH: number, hashpriceUSD: number, poolFeePercent: number = 0): number {
    const grossRevenue = hashrateTH * hashpriceUSD;
    const netRevenue = grossRevenue * (1 - poolFeePercent / 100);
    return netRevenue;
}
