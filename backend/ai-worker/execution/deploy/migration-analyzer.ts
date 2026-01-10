import { promises as fs } from 'fs';
import * as path from 'path';

export interface MigrationRisk {
  level: 'safe' | 'warning' | 'destructive';
  reason: string;
  sqlPattern?: string;
  affectedTable?: string;
  fileName?: string;
}

/**
 * Analyzes database migration files for destructive patterns.
 * Used by AI workers to detect risky changes before deployment.
 */
export class MigrationAnalyzer {
  private migrationsDir: string;

  // Destructive SQL patterns that require approval
  private readonly destructivePatterns = [
    {
      pattern: /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?([a-z_]+)/gi,
      level: 'destructive' as const,
      getReason: (match: string) => `Drops table: ${match}`,
      extractTable: (match: RegExpMatchArray) => match[1],
    },
    {
      pattern: /DROP\s+DATABASE\s+(?:IF\s+EXISTS\s+)?([a-z_]+)/gi,
      level: 'destructive' as const,
      getReason: (match: string) => `Drops entire database: ${match}`,
      extractTable: (match: RegExpMatchArray) => match[1],
    },
    {
      pattern: /TRUNCATE\s+(?:TABLE\s+)?([a-z_]+)/gi,
      level: 'destructive' as const,
      getReason: (match: string) => `Truncates all data from table: ${match}`,
      extractTable: (match: RegExpMatchArray) => match[1],
    },
    {
      pattern: /ALTER\s+TABLE\s+([a-z_]+)\s+DROP\s+COLUMN\s+([a-z_]+)/gi,
      level: 'destructive' as const,
      getReason: (match: string) => `Drops column: ${match}`,
      extractTable: (match: RegExpMatchArray) => match[1],
    },
    {
      pattern: /DELETE\s+FROM\s+([a-z_]+)(?!\s+WHERE)/gi,
      level: 'destructive' as const,
      getReason: (match: string) => `Deletes all rows from table without WHERE clause: ${match}`,
      extractTable: (match: RegExpMatchArray) => match[1],
    },
  ];

  // Warning patterns that are risky but not necessarily destructive
  private readonly warningPatterns = [
    {
      pattern: /ALTER\s+TABLE\s+([a-z_]+)\s+ALTER\s+COLUMN\s+([a-z_]+)\s+(?:SET\s+)?NOT\s+NULL/gi,
      level: 'warning' as const,
      getReason: (match: string) => `Sets column to NOT NULL (may fail if existing rows have nulls): ${match}`,
      extractTable: (match: RegExpMatchArray) => match[1],
    },
    {
      pattern: /ALTER\s+TABLE\s+([a-z_]+)\s+ADD\s+(?:CONSTRAINT|CHECK|UNIQUE)/gi,
      level: 'warning' as const,
      getReason: (match: string) => `Adds constraint (may fail on existing data): ${match}`,
      extractTable: (match: RegExpMatchArray) => match[1],
    },
    {
      pattern: /CREATE\s+UNIQUE\s+INDEX/gi,
      level: 'warning' as const,
      getReason: (match: string) => `Creates unique index (may fail if duplicates exist): ${match}`,
      extractTable: () => undefined,
    },
  ];

  constructor(migrationsDir?: string) {
    // Default to backend migrations directory
    this.migrationsDir = migrationsDir || path.join(
      __dirname,
      '..',
      'db',
      'migrations'
    );
  }

  /**
   * Analyze recent migration files for destructive patterns
   * @param sinceHours Only analyze migrations created in the last N hours (default: 24)
   * @returns Array of detected risks
   */
  async analyzeRecentMigrations(sinceHours: number = 24): Promise<MigrationRisk[]> {
    const risks: MigrationRisk[] = [];

    try {
      // Get all migration files
      const files = await fs.readdir(this.migrationsDir);
      const sqlFiles = files.filter(f => f.endsWith('.sql'));

      // Filter by modification time
      const cutoffTime = Date.now() - (sinceHours * 60 * 60 * 1000);
      const recentFiles: string[] = [];

      for (const file of sqlFiles) {
        const filePath = path.join(this.migrationsDir, file);
        const stats = await fs.stat(filePath);

        // Check modification time (when file was last changed)
        if (stats.mtimeMs >= cutoffTime) {
          recentFiles.push(file);
        }
      }

      console.error('[MigrationAnalyzer] Analyzing recent migrations:', JSON.stringify({
        totalFiles: sqlFiles.length,
        recentFiles: recentFiles.length,
        sinceHours,
      }));

      // Analyze each recent file
      for (const file of recentFiles) {
        const filePath = path.join(this.migrationsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');

        // Check for destructive patterns
        for (const { pattern, level, getReason, extractTable } of this.destructivePatterns) {
          // Reset regex state
          pattern.lastIndex = 0;

          let match: RegExpMatchArray | null;
          while ((match = pattern.exec(content)) !== null) {
            risks.push({
              level,
              reason: getReason(match[0]),
              sqlPattern: match[0],
              affectedTable: extractTable(match),
              fileName: file,
            });
          }
        }

        // Check for warning patterns
        for (const { pattern, level, getReason, extractTable } of this.warningPatterns) {
          // Reset regex state
          pattern.lastIndex = 0;

          let match: RegExpMatchArray | null;
          while ((match = pattern.exec(content)) !== null) {
            risks.push({
              level,
              reason: getReason(match[0]),
              sqlPattern: match[0],
              affectedTable: extractTable(match),
              fileName: file,
            });
          }
        }

        // If no patterns detected, mark as safe
        if (!risks.find(r => r.fileName === file)) {
          risks.push({
            level: 'safe',
            reason: 'No destructive patterns detected',
            fileName: file,
          });
        }
      }

      // If no recent migrations found, return safe status
      if (recentFiles.length === 0) {
        risks.push({
          level: 'safe',
          reason: 'No migrations modified in the specified time window',
        });
      }

      console.error('[MigrationAnalyzer] Analysis complete:', JSON.stringify({
        totalRisks: risks.length,
        destructive: risks.filter(r => r.level === 'destructive').length,
        warnings: risks.filter(r => r.level === 'warning').length,
        safe: risks.filter(r => r.level === 'safe').length,
      }));

      return risks;
    } catch (error) {
      console.error('[MigrationAnalyzer] Failed to analyze migrations:', error);
      throw new Error(`Failed to analyze migrations: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Analyze a specific migration file
   * @param fileName Migration file name (e.g., '001_initial_schema.sql')
   * @returns Array of detected risks
   */
  async analyzeMigrationFile(fileName: string): Promise<MigrationRisk[]> {
    const risks: MigrationRisk[] = [];
    const filePath = path.join(this.migrationsDir, fileName);

    try {
      const content = await fs.readFile(filePath, 'utf-8');

      // Check for destructive patterns
      for (const { pattern, level, getReason, extractTable } of this.destructivePatterns) {
        pattern.lastIndex = 0;

        let match: RegExpMatchArray | null;
        while ((match = pattern.exec(content)) !== null) {
          risks.push({
            level,
            reason: getReason(match[0]),
            sqlPattern: match[0],
            affectedTable: extractTable(match),
            fileName,
          });
        }
      }

      // Check for warning patterns
      for (const { pattern, level, getReason, extractTable } of this.warningPatterns) {
        pattern.lastIndex = 0;

        let match: RegExpMatchArray | null;
        while ((match = pattern.exec(content)) !== null) {
          risks.push({
            level,
            reason: getReason(match[0]),
            sqlPattern: match[0],
            affectedTable: extractTable(match),
            fileName,
          });
        }
      }

      // If no patterns detected, mark as safe
      if (risks.length === 0) {
        risks.push({
          level: 'safe',
          reason: 'No destructive patterns detected',
          fileName,
        });
      }

      return risks;
    } catch (error) {
      console.error('[MigrationAnalyzer] Failed to analyze migration file:', fileName, error);
      throw new Error(`Failed to analyze migration file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if any detected risks require approval
   * @param risks Array of detected risks
   * @returns True if any destructive or warning risks detected
   */
  requiresApproval(risks: MigrationRisk[]): boolean {
    return risks.some(r => r.level === 'destructive' || r.level === 'warning');
  }

  /**
   * Get summary of risks by level
   * @param risks Array of detected risks
   * @returns Summary object with counts by level
   */
  getSummary(risks: MigrationRisk[]): { destructive: number; warning: number; safe: number } {
    return {
      destructive: risks.filter(r => r.level === 'destructive').length,
      warning: risks.filter(r => r.level === 'warning').length,
      safe: risks.filter(r => r.level === 'safe').length,
    };
  }
}
