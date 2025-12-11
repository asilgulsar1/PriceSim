import { createInitialStats } from './gamification-store';
import { calculateReadingUpdate, calculateQuizUpdate } from './gamification-engine';

describe('Gamification Engine', () => {

    const baseStats = createInitialStats('test@example.com');

    describe('calculateReadingUpdate', () => {
        it('should increment streak if valid consecutive day', () => {
            // Setup: Last active was yesterday
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            const stats = { ...baseStats, lastActive: yesterday.toISOString(), currentStreak: 1, points: 0 };
            const now = new Date();

            const updated = calculateReadingUpdate(stats, now);
            expect(updated.currentStreak).toBe(2);
            expect(updated.points).toBe(20); // 2 * 10
        });

        it('should reset streak if missed a day', () => {
            // Setup: Last active was 2 days ago
            const twoDaysAgo = new Date();
            twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

            const stats = { ...baseStats, lastActive: twoDaysAgo.toISOString(), currentStreak: 5, points: 100 };
            const now = new Date();

            const updated = calculateReadingUpdate(stats, now);
            expect(updated.currentStreak).toBe(1); // Reset
            expect(updated.points).toBe(110); // 100 + (1 * 10) for today
        });

        it('should not increment streak multiple times same day', () => {
            const now = new Date();
            const stats = { ...baseStats, lastActive: now.toISOString(), currentStreak: 1, points: 10 };

            // 5 mins later
            const later = new Date(now.getTime() + 5 * 60000);

            const updated = calculateReadingUpdate(stats, later);
            expect(updated.currentStreak).toBe(1);
            expect(updated.points).toBe(10); // No change
        });
    });

    describe('calculateQuizUpdate', () => {
        it('should update accuracy and points correctly', () => {
            const stats = { ...baseStats, totalQuizzes: 0, accuracyScore: 0, points: 0 };

            // Perfect score (3/3)
            const updated = calculateQuizUpdate(stats, { total: 3, correct: 3 });

            expect(updated.totalQuizzes).toBe(1);
            expect(updated.accuracyScore).toBe(100);
            expect(updated.points).toBe(30 + 50); // 30 for questions + 50 bonus
        });

        it('should calculate moving average accuracy', () => {
            // Previous: 1 quiz, 100% score
            const stats = { ...baseStats, totalQuizzes: 1, accuracyScore: 100, points: 80 };

            // New: 0/3 (0%)
            const updated = calculateQuizUpdate(stats, { total: 3, correct: 0 });

            expect(updated.totalQuizzes).toBe(2);
            expect(updated.accuracyScore).toBe(50); // (100 + 0) / 2
            expect(updated.points).toBe(80); // No points gained
        });
    });
});
