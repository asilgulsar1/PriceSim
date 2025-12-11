const PIPEDRIVE_API_TOKEN = process.env.PIPEDRIVE_API_TOKEN;
const COMPANY_DOMAIN = process.env.PIPEDRIVE_COMPANY_DOMAIN || 'company'; // e.g. company.pipedrive.com

// Mock interface for Pipedrive Deal
interface Deal {
    id: number;
    title: string;
    status: string;
    stage_id: number;
    update_time: string; // YYYY-MM-DD HH:MM:SS
}

export async function createCallActivity(dealId: number, subject: string) {
    if (!PIPEDRIVE_API_TOKEN) return;

    // https://developers.pipedrive.com/docs/api/v1/Activities#addActivity
    const url = `https://${COMPANY_DOMAIN}.pipedrive.com/api/v1/activities?api_token=${PIPEDRIVE_API_TOKEN}`;

    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subject,
                type: 'call',
                deal_id: dealId,
                due_date: new Date().toISOString().split('T')[0],
                note: 'Automated Market Update Call task'
            })
        });
    } catch (e) {
        console.error("Failed to create Pipedrive activity", e);
    }
}

import { getClientWorkflow, saveClientWorkflow, WorkflowStage } from './blob-store';

export async function runSalesCycle() {
    if (!PIPEDRIVE_API_TOKEN) return;

    try {
        // Fetch open deals sorted by last update
        const url = `https://${COMPANY_DOMAIN}.pipedrive.com/api/v1/deals?status=open&sort=update_time%20ASC&limit=50&api_token=${PIPEDRIVE_API_TOKEN}`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        const deals: Deal[] = data.data || [];

        for (const deal of deals) {
            await checkWorkflowTransitions(deal);
        }
    } catch (e) {
        console.error("Sales Cycle Sync Failed", e);
    }
}

async function checkWorkflowTransitions(deal: Deal) {
    const now = Date.now();
    let state = await getClientWorkflow(deal.id);

    // Init state if missing
    if (!state) {
        state = { dealId: deal.id, workflowStage: 'IDLE', lastInteraction: new Date().toISOString() };
    }

    const lastInteractionTime = new Date(state.lastInteraction).getTime();
    const daysSince = (now - lastInteractionTime) / (1000 * 60 * 60 * 24);

    let nextStage: WorkflowStage | null = null;
    let activitySubject = '';

    switch (state.workflowStage) {
        case 'IDLE':
            // Logic: If deal is stale (> 30 days) in Pipedrive -> Market Update
            // We use the deal.update_time from Pipedrive as the true "last touch" for the first trigger
            const dealLastUpdate = new Date(deal.update_time).getTime();
            const dealDaysSince = (now - dealLastUpdate) / (1000 * 60 * 60 * 24);

            if (dealDaysSince > 30) {
                nextStage = 'MARKET_UPDATE';
                activitySubject = "📞 Market Update Call (30 Day Trigger)";
            }
            break;

        case 'MARKET_UPDATE':
            if (daysSince > 3) {
                nextStage = 'SCALING_PITCH';
                activitySubject = "📈 Pitch Scaling / Mining Expansion";
            }
            break;

        case 'SCALING_PITCH':
            if (daysSince > 3) {
                nextStage = 'PRICE_PITCH';
                activitySubject = "💰 Pitch Price Angle / Discount";
            }
            break;

        case 'PRICE_PITCH':
            if (daysSince > 3) {
                nextStage = 'MGMT_ESCALATION';
                activitySubject = "⚠️ Escalate to Management (Proposal)";
            }
            break;

        case 'MGMT_ESCALATION':
            if (daysSince > 30) {
                // Reset loop
                nextStage = 'IDLE';
                // No activity, just silent reset
            }
            break;
    }

    if (nextStage) {
        console.log(`Transitioning Deal ${deal.id} from ${state.workflowStage} to ${nextStage}`);
        if (activitySubject) {
            await createCallActivity(deal.id, activitySubject);
        }
        state.workflowStage = nextStage;
        state.lastInteraction = new Date().toISOString();
        await saveClientWorkflow(state);
    }
}

