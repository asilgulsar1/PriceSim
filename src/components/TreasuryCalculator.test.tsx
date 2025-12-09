import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { TreasuryCalculator } from './TreasuryCalculator';
import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { TextEncoder, TextDecoder } from 'util';

// Polyfill TextEncoder
global.TextEncoder = TextEncoder as any;
global.TextDecoder = TextDecoder as any;

// Mock API
jest.mock('@/lib/api', () => ({
    fetchMarketData: jest.fn().mockResolvedValue({
        btcPrice: 65000,
        networkDifficulty: 86000000000000
    })
}));

// Mock TreasuryChart to avoid Recharts issues in JSDOM
jest.mock('@/components/treasury-chart', () => ({
    TreasuryChart: () => <div data-testid="treasury-chart">Chart</div>
}));

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
}));

// Mock dependencies
jest.mock('html-to-image', () => ({
    toJpeg: jest.fn(),
}));

jest.mock('jspdf', () => {
    return {
        jsPDF: jest.fn().mockImplementation(() => ({
            internal: {
                pageSize: {
                    getWidth: () => 210,
                    getHeight: () => 297,
                },
            },
            getImageProperties: () => ({
                width: 100,
                height: 100,
            }),
            addImage: jest.fn(),
            addPage: jest.fn(),
            setFontSize: jest.fn(),
            text: jest.fn(),
            output: jest.fn().mockReturnValue(new Blob(['test'], { type: 'application/pdf' })),
            save: jest.fn(),
        })),
    };
});

jest.mock('jspdf-autotable', () => jest.fn());

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = jest.fn(() => 'blob:test-url');
global.URL.revokeObjectURL = jest.fn();

describe('TreasuryCalculator PDF Export', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should export PDF with correct filename and extension when Export PDF button is clicked', async () => {
        // Mock toJpeg response
        (toJpeg as jest.Mock).mockResolvedValue('data:image/jpeg;base64,test');

        render(<TreasuryCalculator />);

        // Wait for simulation to run (it runs on mount)
        await waitFor(() => {
            expect(screen.getByText('Run Simulation')).toBeInTheDocument();
        });

        // Click Run Simulation to ensure we have results
        fireEvent.click(screen.getByText('Run Simulation'));

        // Wait for results to appear
        await waitFor(() => {
            expect(screen.getByText('Treasury Projection')).toBeInTheDocument();
        });

        // Find and click Export PDF button
        const exportBtn = screen.getByText('Export PDF');
        fireEvent.click(exportBtn);

        // Verify html-to-image was called
        await waitFor(() => {
            expect(toJpeg).toHaveBeenCalled();
        });

        // Verify manual download trigger
        // We can't easily spy on document.createElement in JSDOM in a way that captures the element instance easily 
        // without more setup, but we can verify the side effects or spy on document.body.appendChild

        // However, since we are mocking the whole flow, the critical part is that the code runs without error
        // and calls the expected libraries.

        // Let's verify jsPDF was instantiated
        expect(jsPDF).toHaveBeenCalled();

        // Verify the filename logic
        // We can check if the link was created and clicked.
        // A common way is to spy on document.createElement
        const createElementSpy = jest.spyOn(document, 'createElement');

        // Re-trigger click to capture the spy
        fireEvent.click(exportBtn);

        await waitFor(() => {
            expect(createElementSpy).toHaveBeenCalledWith('a');
        });

        // Check if any created anchor tag has the correct download attribute
        const anchorTags = createElementSpy.mock.results
            .filter(r => r.value.tagName === 'A')
            .map(r => r.value as HTMLAnchorElement);

        const downloadLink = anchorTags.find(a => a.download.startsWith('treasury_simulation_'));

        expect(downloadLink).toBeDefined();

        // Verify the filename format
        // Note: In a real browser, this file would be saved to the user's default Downloads directory.
        // In this test environment (JSDOM), no file is actually written to disk.
        // We verify that the application *instructed* the browser to download the file with the correct name.
        const expectedFilenamePattern = /treasury_simulation_antminer_s21_pro_\d{4}-\d{2}-\d{2}\.pdf/;
        expect(downloadLink?.download).toMatch(expectedFilenamePattern);

        console.log(`Test verified download trigger for filename: ${downloadLink?.download}`);

        expect(downloadLink?.type).toBe('application/pdf');
        expect(downloadLink?.href).toBe('blob:test-url');
    });

    it('should export CSV with correct filename and extension when Export CSV button is clicked', async () => {
        const user = userEvent.setup();

        // Mock URL.createObjectURL
        const createElementSpy = jest.spyOn(document, 'createElement');

        render(<TreasuryCalculator />);

        // Wait for simulation to run
        await waitFor(() => {
            expect(screen.getByText('Treasury Projection')).toBeInTheDocument();
        });

        // Find and click Export CSV button
        const exportBtn = screen.getByRole('button', { name: /Export CSV/i });
        await user.click(exportBtn);

        // Check if any created anchor tag has the correct download attribute
        const anchorTags = createElementSpy.mock.results
            .filter(r => r.value.tagName === 'A')
            .map(r => r.value as HTMLAnchorElement);

        const downloadLink = anchorTags.find(a => a.download.startsWith('treasury_simulation_') && a.download.endsWith('.csv'));

        expect(downloadLink).toBeDefined();

        // Verify the filename format
        const expectedFilenamePattern = /treasury_simulation_antminer_s21_pro_\d{4}-\d{2}-\d{2}\.csv/;
        expect(downloadLink?.download).toMatch(expectedFilenamePattern);

        console.log(`Test verified download trigger for filename: ${downloadLink?.download}`);

        // Note: MIME type might include charset, so we check if it contains text/csv
        expect(downloadLink?.type).toContain('text/csv');
        expect(downloadLink?.href).toBe('blob:test-url');
    });
});
