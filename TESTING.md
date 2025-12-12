# Testing & Deployment Workflow

## Overview
This project enforces a strict "Lint -> Test -> Build" workflow to ensure that no broken code is ever deployed. All agents and developers must adhere to this process.

## The "Pre-Deploy" Check
Before any deployment (or when asked to "verify" changes), you must run:

```bash
npm run predeploy
```

This command runs the following steps in order:
1.  **Lint**: `npm run lint` - Checks for static code analysis errors and style issues.
2.  **Test**: `npm test` - Runs all unit and integration tests.
3.  **Build**: `npm run build` - Verifies that the Next.js application compiles correctly (checking types, pages, and components).

**If ANY step fails, the deployment is forbidden.**

## Testing Levels
We use two levels of testing:

### 1. Unit Tests (`*.test.ts`, `*.test.tsx`)
-   **Purpose**: Test individual functions or isolated components.
-   **Mocks**: It is acceptable to mock dependencies (like API calls or complex calculators) here to test the UI in isolation.
-   **Location**: Co-located with the file (e.g., `src/lib/calculator.ts` -> `src/lib/calculator.test.ts`).

### 2. Integration Tests (`*.integration.test.tsx`)
-   **Purpose**: Test the "Logical Flow" from the UI down to the core logic.
-   **Mocks**: **DO NOT MOCK** the core business logic (e.g., `MiningCalculator`, `solveMinerPrice`).
-   **Goal**: Ensure that when a user interacts with the UI, the *real* mathematical engine produces the correct result.
-   **Location**: `src/components/PriceSimulator.integration.test.tsx`

## Writing New Tests
-   Always use `act(...)` when triggering state updates in UI tests.
-   Clean up mocks in `beforeEach` to prevent pollution between tests.
-   For complex logic, prefer adding an Integration Test over a mocked Unit Test.
