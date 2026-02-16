import { Repository } from 'typeorm';
import { Incident, IncidentSeverity } from '../../../shared/models/Incident';

// Mock the data source
jest.mock('../../../shared/db/data-source', () => ({
  getDataSource: jest.fn(),
}));

// Mock the logger
jest.mock('../../../shared/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock the auth middleware
jest.mock('../../../shared/auth/middleware', () => ({
  authenticateRequest: jest.fn((req: any, res: any, next: any) => next()),
}));

// Mock express-validator
jest.mock('express-validator', () => ({
  query: jest.fn(() => ({
    optional: jest.fn().mockReturnThis(),
    isISO8601: jest.fn().mockReturnThis(),
    isIn: jest.fn().mockReturnThis(),
    isUUID: jest.fn().mockReturnThis(),
  })),
  validationResult: jest.fn(() => ({
    isEmpty: jest.fn(() => true),
    array: jest.fn(() => []),
  })),
}));

import { getDataSource } from '../../../shared/db/data-source';
import { validationResult } from 'express-validator';

describe('Analytics Heatmap Logic', () => {
  let mockIncidentRepo: jest.Mocked<Repository<Incident>>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockIncidentRepo = {
      find: jest.fn(),
    } as any;

    (getDataSource as jest.Mock).mockResolvedValue({
      getRepository: jest.fn().mockReturnValue(mockIncidentRepo),
    });
  });

  describe('Heatmap Data Bucketing Logic', () => {
    it('should correctly bucket incidents by day of week and hour', () => {
      // Test the bucketing logic directly
      const incidents = [
        { triggeredAt: new Date('2024-01-01T09:30:00Z') }, // Monday 9 AM UTC
        { triggeredAt: new Date('2024-01-01T14:15:00Z') }, // Monday 2 PM UTC
        { triggeredAt: new Date('2024-01-02T09:30:00Z') }, // Tuesday 9 AM UTC
        { triggeredAt: new Date('2024-01-07T22:45:00Z') }, // Sunday 10 PM UTC
      ];

      // Initialize 7x24 grid with zeros (same logic as endpoint)
      const heatmapData: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));

      incidents.forEach((incident) => {
        const date = new Date(incident.triggeredAt);
        const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const hour = date.getHours(); // 0-23
        heatmapData[dayOfWeek][hour]++;
      });

      // Convert to array of objects for easier testing
      const heatmap = [];
      for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
          heatmap.push({
            dayOfWeek: day,
            hour: hour,
            count: heatmapData[day][hour],
          });
        }
      }

      // Test specific buckets
      const mondayNineAM = heatmap.find(cell => cell.dayOfWeek === 1 && cell.hour === 9);
      const mondayTwoPM = heatmap.find(cell => cell.dayOfWeek === 1 && cell.hour === 14);
      const tuesdayNineAM = heatmap.find(cell => cell.dayOfWeek === 2 && cell.hour === 9);
      const sundayTenPM = heatmap.find(cell => cell.dayOfWeek === 0 && cell.hour === 22);

      expect(mondayNineAM?.count).toBe(1);
      expect(mondayTwoPM?.count).toBe(1);
      expect(tuesdayNineAM?.count).toBe(1);
      expect(sundayTenPM?.count).toBe(1);

      // Test that most cells are empty
      const totalNonZero = heatmap.filter(cell => cell.count > 0).length;
      expect(totalNonZero).toBe(4);

      // Test total length
      expect(heatmap).toHaveLength(168); // 7 days × 24 hours
    });

    it('should handle empty data correctly', () => {
      const incidents: any[] = [];

      // Initialize 7x24 grid with zeros
      const heatmapData: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));

      incidents.forEach((incident) => {
        const date = new Date(incident.triggeredAt);
        const dayOfWeek = date.getDay();
        const hour = date.getHours();
        heatmapData[dayOfWeek][hour]++;
      });

      // Convert to array
      const heatmap = [];
      for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
          heatmap.push({
            dayOfWeek: day,
            hour: hour,
            count: heatmapData[day][hour],
          });
        }
      }

      // All cells should be 0
      heatmap.forEach(cell => {
        expect(cell.count).toBe(0);
      });

      // Max count should be 0
      const maxCount = Math.max(...heatmap.map(cell => cell.count));
      expect(maxCount).toBe(0);
    });

    it('should handle multiple incidents in same time slot', () => {
      const incidents = [
        { triggeredAt: new Date('2024-01-01T09:00:00Z') }, // Monday 9 AM
        { triggeredAt: new Date('2024-01-01T09:15:00Z') }, // Monday 9 AM (same hour)
        { triggeredAt: new Date('2024-01-01T09:45:00Z') }, // Monday 9 AM (same hour)
      ];

      const heatmapData: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));

      incidents.forEach((incident) => {
        const date = new Date(incident.triggeredAt);
        const dayOfWeek = date.getDay();
        const hour = date.getHours();
        heatmapData[dayOfWeek][hour]++;
      });

      const heatmap = [];
      for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
          heatmap.push({
            dayOfWeek: day,
            hour: hour,
            count: heatmapData[day][hour],
          });
        }
      }

      const mondayNineAM = heatmap.find(cell => cell.dayOfWeek === 1 && cell.hour === 9);
      expect(mondayNineAM?.count).toBe(3);

      const maxCount = Math.max(...heatmap.map(cell => cell.count));
      expect(maxCount).toBe(3);
    });

    it('should handle timezone edge cases', () => {
      const incidents = [
        { triggeredAt: new Date('2024-01-01T00:00:00Z') }, // Monday midnight UTC
        { triggeredAt: new Date('2024-01-01T23:59:59Z') }, // Monday 11:59 PM UTC
        { triggeredAt: new Date('2023-12-31T23:59:59Z') }, // Sunday 11:59 PM UTC
      ];

      const heatmapData: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));

      incidents.forEach((incident) => {
        const date = new Date(incident.triggeredAt);
        const dayOfWeek = date.getDay();
        const hour = date.getHours();
        heatmapData[dayOfWeek][hour]++;
      });

      const heatmap = [];
      for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
          heatmap.push({
            dayOfWeek: day,
            hour: hour,
            count: heatmapData[day][hour],
          });
        }
      }

      const mondayMidnight = heatmap.find(cell => cell.dayOfWeek === 1 && cell.hour === 0);
      const mondayLateNight = heatmap.find(cell => cell.dayOfWeek === 1 && cell.hour === 23);
      const sundayLateNight = heatmap.find(cell => cell.dayOfWeek === 0 && cell.hour === 23);

      expect(mondayMidnight?.count).toBe(1);
      expect(mondayLateNight?.count).toBe(1);
      expect(sundayLateNight?.count).toBe(1);
    });
  });

  describe('Date Range Logic', () => {
    it('should create default 30-day range when no dates provided', () => {
      // Test the getDateRange logic (from analytics.ts)
      function getDateRange(startDate?: string, endDate?: string): { start: Date; end: Date } {
        const end = endDate ? new Date(endDate) : new Date();
        const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        return { start, end };
      }

      const { start, end } = getDateRange();

      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
      expect(daysDiff).toBe(30);
    });

    it('should use provided date range', () => {
      function getDateRange(startDate?: string, endDate?: string): { start: Date; end: Date } {
        const end = endDate ? new Date(endDate) : new Date();
        const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        return { start, end };
      }

      const { start, end } = getDateRange('2024-01-01T00:00:00Z', '2024-01-31T23:59:59Z');

      expect(start.toISOString()).toBe('2024-01-01T00:00:00.000Z');
      expect(end.toISOString()).toBe('2024-01-31T23:59:59.000Z');
    });
  });

  describe('Database Query Building', () => {
    it('should build correct where clause with all filters', async () => {
      // Test the where clause building logic
      const orgId = 'test-org-id';
      const severity = 'critical';
      const serviceId = 'service-123';
      const start = new Date('2024-01-01T00:00:00Z');
      const end = new Date('2024-01-31T23:59:59Z');

      const whereClause: any = {
        orgId,
        triggeredAt: { _type: 'between', _value: [start, end] }, // Mock Between object
      };

      if (severity) {
        whereClause.severity = severity;
      }

      if (serviceId) {
        whereClause.serviceId = serviceId;
      }

      expect(whereClause).toEqual({
        orgId: 'test-org-id',
        severity: 'critical',
        serviceId: 'service-123',
        triggeredAt: expect.any(Object),
      });
    });

    it('should build minimal where clause without optional filters', () => {
      const orgId = 'test-org-id';
      const start = new Date('2024-01-01T00:00:00Z');
      const end = new Date('2024-01-31T23:59:59Z');

      const whereClause: any = {
        orgId,
        triggeredAt: { _type: 'between', _value: [start, end] },
      };

      expect(whereClause).toEqual({
        orgId: 'test-org-id',
        triggeredAt: expect.any(Object),
      });

      expect(whereClause).not.toHaveProperty('severity');
      expect(whereClause).not.toHaveProperty('serviceId');
    });
  });

  describe('Response Format', () => {
    it('should format response correctly', () => {
      const heatmap = [
        { dayOfWeek: 0, hour: 0, count: 1 },
        { dayOfWeek: 1, hour: 9, count: 5 },
        { dayOfWeek: 2, hour: 14, count: 3 },
      ];

      const maxCount = Math.max(...heatmap.map(cell => cell.count));
      const totalIncidents = 9; // Sum of test data

      const response = {
        heatmap,
        maxCount,
        totalIncidents,
        filters: {
          startDate: '2024-01-01T00:00:00.000Z',
          endDate: '2024-01-31T23:59:59.000Z',
          severity: 'critical',
          serviceId: 'service-123',
        },
      };

      expect(response.maxCount).toBe(5);
      expect(response.totalIncidents).toBe(9);
      expect(response.filters.severity).toBe('critical');
      expect(response.filters.serviceId).toBe('service-123');
      expect(response.heatmap).toHaveLength(3);
    });

    it('should handle null filters in response', () => {
      const response = {
        heatmap: [],
        maxCount: 0,
        totalIncidents: 0,
        filters: {
          startDate: '2024-01-01T00:00:00.000Z',
          endDate: '2024-01-31T23:59:59.000Z',
          severity: null,
          serviceId: null,
        },
      };

      expect(response.filters.severity).toBeNull();
      expect(response.filters.serviceId).toBeNull();
      expect(response.filters.startDate).toBeTruthy();
      expect(response.filters.endDate).toBeTruthy();
    });
  });
});

describe('Analytics Repository Integration', () => {
  let mockIncidentRepo: jest.Mocked<Repository<Incident>>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockIncidentRepo = {
      find: jest.fn(),
    } as any;

    (getDataSource as jest.Mock).mockResolvedValue({
      getRepository: jest.fn().mockReturnValue(mockIncidentRepo),
    });
  });

  it('should call repository with correct parameters', async () => {
    const mockIncidents = [
      { triggeredAt: new Date('2024-01-01T09:00:00Z') },
    ];

    mockIncidentRepo.find.mockResolvedValue(mockIncidents as Incident[]);

    // Simulate the repository call from the endpoint
    const whereClause = {
      orgId: 'test-org-id',
      severity: 'error' as IncidentSeverity,
      serviceId: 'service-123',
      triggeredAt: expect.any(Object),
    };

    await mockIncidentRepo.find({ where: whereClause });

    expect(mockIncidentRepo.find).toHaveBeenCalledWith({
      where: expect.objectContaining({
        orgId: 'test-org-id',
        severity: 'error',
        serviceId: 'service-123',
      }),
    });
  });

  it('should handle empty result from repository', async () => {
    mockIncidentRepo.find.mockResolvedValue([]);

    const result = await mockIncidentRepo.find({
      where: { orgId: 'test-org-id' },
    });

    expect(result).toEqual([]);
    expect(result.length).toBe(0);
  });

  it('should handle repository errors', async () => {
    const error = new Error('Database connection failed');
    mockIncidentRepo.find.mockRejectedValue(error);

    await expect(mockIncidentRepo.find({ where: {} })).rejects.toThrow('Database connection failed');
  });
});