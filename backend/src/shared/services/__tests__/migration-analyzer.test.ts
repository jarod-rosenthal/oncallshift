import { MigrationAnalyzer } from '../migration-analyzer';
import * as path from 'path';

describe('MigrationAnalyzer', () => {
  let analyzer: MigrationAnalyzer;

  beforeEach(() => {
    const migrationsDir = path.join(__dirname, '..', '..', 'db', 'migrations');
    analyzer = new MigrationAnalyzer(migrationsDir);
  });

  describe('analyzeRecentMigrations', () => {
    it('should return safe status when no recent migrations', async () => {
      const risks = await analyzer.analyzeRecentMigrations(0); // 0 hours = no files
      expect(risks).toBeDefined();
      expect(Array.isArray(risks)).toBe(true);
      expect(risks.some(r => r.level === 'safe')).toBe(true);
    });

    it('should return array of risks', async () => {
      const risks = await analyzer.analyzeRecentMigrations(24);
      expect(risks).toBeDefined();
      expect(Array.isArray(risks)).toBe(true);
    });
  });

  describe('requiresApproval', () => {
    it('should return true for destructive risks', () => {
      const risks = [
        {
          level: 'destructive' as const,
          reason: 'DROP TABLE users',
          fileName: 'test.sql',
        },
      ];

      expect(analyzer.requiresApproval(risks)).toBe(true);
    });

    it('should return true for warning risks', () => {
      const risks = [
        {
          level: 'warning' as const,
          reason: 'ALTER TABLE users ADD CONSTRAINT',
          fileName: 'test.sql',
        },
      ];

      expect(analyzer.requiresApproval(risks)).toBe(true);
    });

    it('should return false for safe migrations', () => {
      const risks = [
        {
          level: 'safe' as const,
          reason: 'No destructive patterns detected',
          fileName: 'test.sql',
        },
      ];

      expect(analyzer.requiresApproval(risks)).toBe(false);
    });
  });

  describe('getSummary', () => {
    it('should correctly count risks by level', () => {
      const risks = [
        { level: 'destructive' as const, reason: 'DROP TABLE', fileName: 'test1.sql' },
        { level: 'destructive' as const, reason: 'TRUNCATE', fileName: 'test2.sql' },
        { level: 'warning' as const, reason: 'ALTER COLUMN NOT NULL', fileName: 'test3.sql' },
        { level: 'safe' as const, reason: 'No issues', fileName: 'test4.sql' },
      ];

      const summary = analyzer.getSummary(risks);

      expect(summary.destructive).toBe(2);
      expect(summary.warning).toBe(1);
      expect(summary.safe).toBe(1);
    });
  });
});
