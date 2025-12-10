/*
 * 🔒 LOCKED LOGIC 🔒
 * This component's calculation logic and field mappings are finalized.
 * 
 * PASSWORD REQUIRED FOR EDITS: "Pricesim"
 * 
 * Do not modify this file unless the user explicitly provides the password "Pricesim" in the prompt.
 */
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { ContractTerms, MinerProfile, CalculatedMiner } from '@/lib/price-simulator-calculator';
import { solveMinerPrice } from '@/lib/pricing-solver';
import { INITIAL_MINERS } from "@/lib/miner-data";
import { DEFAULT_CONTRACT_TERMS, DEFAULT_TARGET_MARGIN } from "@/lib/constants";
import { useMarketData } from "@/hooks/useMarketData";

// Sub-components
import { PriceSimulatorControls } from "./price-simulator/PriceSimulatorControls";
import { PriceSimulatorTable } from "./price-simulator/PriceSimulatorTable";
import { PriceSimulatorCustomMiner } from "./price-simulator/PriceSimulatorCustomMiner";

export function PriceSimulator() {
    // --- State ---
    const [targetProfitPercent, setTargetProfitPercent] = useState(DEFAULT_TARGET_MARGIN);
    const [isBtcTarget, setIsBtcTarget] = useState(false);

    // Market Data Hook
    const { market, setMarket, loading: marketLoading } = useMarketData();

    // Contract Terms
    const [hostingRate, setHostingRate] = useState(DEFAULT_CONTRACT_TERMS.electricityRate);
    const [durationYears, setDurationYears] = useState(DEFAULT_CONTRACT_TERMS.contractDurationYears);

    // Miners & Results
    const [miners, setMiners] = useState<MinerProfile[]>(INITIAL_MINERS);
    const [results, setResults] = useState<CalculatedMiner[]>([]);
    const [calculating, setCalculating] = useState(false);

    // UI State
    const [sortConfig, setSortConfig] = useState<{ key: keyof CalculatedMiner; direction: 'asc' | 'desc' }>({ key: 'calculatedPrice', direction: 'desc' });
    const [filterText, setFilterText] = useState('');
    const [filterCooling, setFilterCooling] = useState('all');
    const [isAddingMiner, setIsAddingMiner] = useState(false);

    // --- Handlers ---

    const calculatePrices = () => {
        setCalculating(true);
        // Small timeout to allow UI to render loading state
        setTimeout(() => {
            const calculated = miners.map(miner => {
                const contract: ContractTerms = {
                    electricityRate: hostingRate,
                    opexRate: 0, // Assuming all-in hosting rate
                    poolFee: 1.0,
                    contractDurationYears: durationYears
                };

                return solveMinerPrice(
                    miner,
                    contract,
                    market,
                    targetProfitPercent,
                    isBtcTarget
                );
            });

            // Pre-sort to match default view
            calculated.sort((a, b) => b.calculatedPrice - a.calculatedPrice);

            setResults(calculated as CalculatedMiner[]);
            setCalculating(false);

            // Persist for Price List
            try {
                const simulationData = {
                    updatedAt: new Date().toISOString(),
                    market,
                    contract: {
                        electricityRate: hostingRate,
                        opexRate: 0,
                        poolFee: 1.0,
                        contractDurationYears: durationYears
                    },
                    miners: calculated
                };
                localStorage.setItem('LATEST_SIMULATION_DATA', JSON.stringify(simulationData));
                console.log("Simulation data saved for Price List");
            } catch (e) {
                console.error("Failed to save simulation data", e);
            }

        }, 100);
    };

    const handleAddMiner = (name: string, hashrate: number, power: number) => {
        const miner: MinerProfile = {
            name,
            hashrateTH: hashrate,
            powerWatts: power,
            price: 0
        };

        const updatedMiners = [...miners, miner];
        setMiners(updatedMiners);

        // Persist only custom ones (rudimentary approach)
        // ideally we separate lists, but for now we just filter out INITIAL_MINERS length
        // or just store the new one.
        const customOnly = updatedMiners.slice(INITIAL_MINERS.length);
        localStorage.setItem('custom_miners', JSON.stringify(customOnly));

        setIsAddingMiner(false);
    };

    // --- Render ---

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Miner Pricing Simulator</h2>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setIsAddingMiner(!isAddingMiner)}>
                        {isAddingMiner ? 'Cancel' : 'Add Custom Miner'}
                    </Button>
                    <Button onClick={calculatePrices} disabled={calculating || marketLoading}>
                        {(calculating || marketLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {!(calculating || marketLoading) && <RefreshCw className="mr-2 h-4 w-4" />}
                        Calculate
                    </Button>
                </div>
            </div>

            <PriceSimulatorControls
                targetProfitPercent={targetProfitPercent}
                setTargetProfitPercent={setTargetProfitPercent}
                isBtcTarget={isBtcTarget}
                setIsBtcTarget={setIsBtcTarget}
                market={market}
                setMarket={setMarket}
                hostingRate={hostingRate}
                setHostingRate={setHostingRate}
                durationYears={durationYears}
                setDurationYears={setDurationYears}
            />

            {isAddingMiner && (
                <PriceSimulatorCustomMiner
                    onAddMiner={handleAddMiner}
                    onCancel={() => setIsAddingMiner(false)}
                />
            )}

            <PriceSimulatorTable
                results={results}
                sortConfig={sortConfig}
                setSortConfig={setSortConfig}
                filterText={filterText}
                setFilterText={setFilterText}
                filterCooling={filterCooling}
                setFilterCooling={setFilterCooling}
                durationYears={durationYears}
            />
        </div>
    );
}
