"use client";

import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface PriceSimulatorCustomMinerProps {
    onAddMiner: (name: string, hashrate: number, power: number) => void;
    onCancel: () => void;
}

export function PriceSimulatorCustomMiner({ onAddMiner, onCancel }: PriceSimulatorCustomMinerProps) {
    const [newMiner, setNewMiner] = useState({ name: '', hashrate: '', power: '' });

    const handleAdd = () => {
        if (!newMiner.name || !newMiner.hashrate || !newMiner.power) return;
        onAddMiner(newMiner.name, Number(newMiner.hashrate), Number(newMiner.power));
        setNewMiner({ name: '', hashrate: '', power: '' });
    };

    return (
        <Card className="bg-muted/50 border-dashed">
            <CardContent className="flex items-end gap-4 pt-6">
                <div className="space-y-2 flex-1">
                    <Label>Miner Name</Label>
                    <Input
                        value={newMiner.name}
                        onChange={e => setNewMiner({ ...newMiner, name: e.target.value })}
                        placeholder="Antminer S21 Pro"
                    />
                </div>
                <div className="space-y-2 w-32">
                    <Label>Hashrate (TH)</Label>
                    <Input
                        type="number"
                        value={newMiner.hashrate}
                        onChange={e => setNewMiner({ ...newMiner, hashrate: e.target.value })}
                        placeholder="200"
                    />
                </div>
                <div className="space-y-2 w-32">
                    <Label>Power (W)</Label>
                    <Input
                        type="number"
                        value={newMiner.power}
                        onChange={e => setNewMiner({ ...newMiner, power: e.target.value })}
                        placeholder="3000"
                    />
                </div>
                <Button onClick={handleAdd}>Add</Button>
                <Button variant="ghost" onClick={onCancel}>Cancel</Button>
            </CardContent>
        </Card>
    );
}
