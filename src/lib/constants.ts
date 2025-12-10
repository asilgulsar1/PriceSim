import { MarketConditions, ContractTerms } from './price-simulator-calculator';

export const DEFAULT_MARKET_CONDITIONS: MarketConditions = {
    // Standardized Default: ~101.6 T (Dec 2024 Market)
    btcPrice: 96500,
    networkDifficulty: 101.6e12,
    blockReward: 3.125,
    difficultyGrowthMonthly: 4.0,
    btcPriceGrowthMonthly: 2.5,
    btcPriceGrowthAnnual: 34.5, // Approx derived from monthly, kept for legacy field support
    nextHalvingDate: new Date('2028-05-01')
};

export const DEFAULT_CONTRACT_TERMS: ContractTerms = {
    // Standardized Default: $0.075 Rate, 5 Years, 1.0% Pool
    electricityRate: 0.06,
    opexRate: 0,
    poolFee: 1.0,
    contractDurationYears: 5
};

export const DEFAULT_TARGET_MARGIN = 50;
