import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { PriceListTable } from './PriceListTable'
import { MinerScoreDetail } from '@/lib/miner-scoring'
import { CalculatedMiner } from '@/lib/price-simulator-calculator'

// Mock CalculatedMiner data
const mockMinerProfile: CalculatedMiner = {
    name: "Antminer S21 Test",
    hashrateTH: 200,
    powerWatts: 3500,
    price: 4000,
    calculatedPrice: 4500,
    projectLifeDays: 1460,
    totalRevenueUSD: 20000,
    totalCostUSD: 10000,
    estExpenseBTC: 0.2,
    estRevenueHostingBTC: 0.1,
    finalTreasuryBTC: 0.5,
    finalTreasuryUSD: 30000,
    projections: [],
    roiPercent: 150,
    targetMet: true,
    clientProfitabilityPercent: 200,
    dailyRevenueUSD: 40,
    dailyExpenseUSD: 15
}

const mockMiners: MinerScoreDetail[] = [
    {
        miner: mockMinerProfile,
        score: 85,
        metrics: { profitabilityScore: 20, revenueScore: 20, ageScore: 10, efficiencyScore: 10 },
        raw: { profitability: 200, revenue: 40, year: 2024, efficiency: 17.5 }
    }
]

describe('PriceListTable', () => {
    it('renders miner name as plain text (not a link)', () => {
        render(<PriceListTable miners={mockMiners} />)

        // precise regex or string match - might find multiple due to mobile/desktop views
        const textElements = screen.getAllByText(/Antminer S21 Test/i)

        // Verify it exists
        expect(textElements.length).toBeGreaterThan(0)

        // Verify it is NOT a link
        const link = screen.queryByRole('link', { name: /Antminer S21 Test/i })
        expect(link).not.toBeInTheDocument()
    })

    it('displays correct hashrate and power', () => {
        render(<PriceListTable miners={mockMiners} />)
        expect(screen.getAllByText('200 T').length).toBeGreaterThan(0)
        expect(screen.getAllByText('3500 W').length).toBeGreaterThan(0)
    })

    it('calculates efficiency correctly', () => {
        render(<PriceListTable miners={mockMiners} />)
        // 3500 / 200 = 17.5
        expect(screen.getAllByText('17.5 J/T').length).toBeGreaterThan(0)
    })
})
