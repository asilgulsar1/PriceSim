# AI Context & Rules for Price Simulation Support

This file defines the strict rules, context, and architectural standards for this codebase. 
**ALL AI AGENTS MUST READ AND FOLLOW THESE RULES.**

## 1. Core Identity & Business Logic
This application simulates Bitcoin mining contract profitability for **Segments** (the business) and its **Clients**.
- **Goal**: Calculate the "Suggested Price" of a mining contract to achieve a specific margin (e.g., 50%) for the business, while ensuring clarity on client ROI.
- **Treasury Model**: The business holds assets in **BTC**, not USD. The simulator must account for BTC price appreciation when calculating the business's final treasury value.
- **Halving**: The simulation MUST correctly handle Bitcoin halving events (reducing block reward by 50% at specific dates).

## 2. Critical "Locked" Files
The following files contain complex, verified financial logic. **Do not modify them unless explicitly requested and you have fully understood the implications.**
- `src/lib/price-simulator-calculator.ts` (The "Engine" - calculates daily production/cost/revenue)
- `src/lib/treasury-calculator.ts` (The "Bank" - tracks asset flows, cash vs BTC)
- `src/lib/pricing-solver.ts` (The "Solver" - reverse-engineers price to hit margin targets)

**Rule**: If you modify any file in `src/lib/`, you **MUST** run `npm test` to verify no regressions.

## 3. "Bot" Synchronization Rules
The application has multiple "front-ends" that sell or display contracts. They MUST work in tandem.
- **Components**: 
    1. **Price Simulator** (Web UI)
    2. **Telegram Shop** (`src/components/telegram/TelegramShop.tsx`)
    3. **Price List Generator** (`src/components/PriceListGenerator.tsx`)
    4. **Pipedrive Sync** (Backend jobs)

- **Synchronization Rule**: ALL components must use shared constants and logic from:
    - `src/lib/constants.ts` (For defaults like Market Info, Electricity Rates)
    - `src/lib/pricing-solver.ts` (For calculating prices)
    - `src/lib/miner-data.ts` (For miner hardware specs)

**DO NOT HARDCODE** values (like electricity rate `$0.08` or margin `50%`) in individual components. Import them or fetch them from the shared configuration.

## 4. Coding Standards
- **UI Framework**: Next.js (App Router), Tailwind CSS, Shadcn UI.
- **Styling**: Use `className` with Tailwind. Avoid CSS modules unless necessary.
- **State**: Use React `useState` / `useContext`. Avoid Redux/Zustand unless complex global state is added.
- **Testing**: Jest is the test runner. 
    - Run `npm test` before confirming changes to calculations.
    - Run `npm run dev` to verify UI changes.

## 5. Common Pitfalls (Known Issues)
- **PDF Export**: The PDF generation is fragile. Check `src/components/ProposalDocument.tsx` carefully. 
- **Halving Logic**: Ensure `currentBlockReward` updates correctly on the halving date.
- **Treasury Balance**: Remember that `Treasury` usually accumulates in BTC. Do not mix USD/BTC units without explicit conversion.

## 6. Sub-Projects
### News Strategy & Sales Dashboard (`/news-strategy`)
A standalone Next.js application for the Sales Team.
- **Location**: `news-strategy/` (Separate `package.json`).
- **Port**: Runs on **3001** (`npm run dev -p 3001`).
- **Goal**: Provide daily AI-summarized market news and "Weekly Certification" quizzes for sales staff.
- **Connectivity**:
    - **Shared Data**: Uses the **Main App's Vercel Blob Token** to share the User Database (`users/`).
    - **API Integration**: Fetches live miner profitability from the Main App (`/api/miners/latest`).
- **Key Features**: Interactive Quiz, PDF Reporting, Pipedrive CRM Automation.
- **Future Roadmap**: Continuous News Indexing (NewsAPI/RSS), Celebrity Tracker, and Historical Data Archive.

## 7. Bug & Stability Protocol
**Before any major code change:**
1.  **Check `BUGS.md`**: Ensure you are aware of active issues.
2.  **Run Tests**: `npm test` (or relevant project test script) must pass.
3.  **Log Issues**: If an error is detected during development, update `BUGS.md` immediately.
4.  **Fix Verification**: Do not mark a bug as fixed until you have run tests/verification steps.
