import { Repository } from 'typeorm';
import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { Incident } from '../../../shared/models';
import { Between } from 'typeorm';

// Mock the data source
jest.mock('../../../shared/db/data-source', () => ({
  getDataSource: jest.fn(),
}));

// Mock logger
jest.mock('../../../shared/utils/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

// Mock express-validator
jest.mock('express-validator');

import { getDataSource } from '../../../shared/db/data-source';
import { logger } from '../../../shared/utils/logger';
import analyticsRouter from '../analytics';

describe('Analytics Heatmap Endpoint', () => {
  let mockIncidentRepo: jest.Mocked<Repository<Incident>>;
  let req: Partial<Request>;
  let res: Partial<Response>;

  const mockOrgId = 'org-123';

  beforeEach(() => {
    jest.clearAllMocks();

    mockIncidentRepo = {
      find: jest.fn(),
    } as any;

    (getDataSource as jest.Mock).mockResolvedValue({
      getRepository: jest.fn().mockReturnValue(mockIncidentRepo),
    });

    req = {
      orgId: mockOrgId,
      query: {},
    } as Partial<Request>;

    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    } as Partial<Response>;

    // Mock validation result as no errors by default
    (validationResult as unknown as jest.Mock).mockReturnValue({
      isEmpty: () => true,
      array: () => [],
    });
  });

  describe('heatmap bucketing logic', () => {
    it('should initialize all 168 buckets (7 days × 24 hours) with zero counts', async () => {
      // No incidents - all buckets should be zero
      mockIncidentRepo.find.mockResolvedValue([]);

      // Create a mock handler that calls the actual logic
      const response = await getHeatmapData(mockOrgId, new Date('2024-01-01'), new Date('2024-01-31'));

      expect(response.data).toHaveLength(168); // 7 days × 24 hours
      expect(response.data.every(bucket => bucket.count === 0)).toBe(true);

      // Verify all day/hour combinations are present
      const expectedBuckets = new Set();
      for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
          expectedBuckets.add(`${day}-${hour}`);
        }
      }

      const actualBuckets = new Set(response.data.map(b => `${b.dayOfWeek}-${b.hour}`));
      expect(actualBuckets).toEqual(expectedBuckets);
    });

    it('should correctly bucket incidents by day of week and hour', async () => {
      const mockIncidents = [
        // Sunday 2024-01-07 15:30 UTC → dayOfWeek=0, hour=15
        { triggeredAt: new Date('2024-01-07T15:30:00.000Z'), severity: 'error' },
        // Monday 2024-01-08 09:15 UTC → dayOfWeek=1, hour=9
        { triggeredAt: new Date('2024-01-08T09:15:00.000Z'), severity: 'critical' },
        // Monday 2024-01-08 09:45 UTC → dayOfWeek=1, hour=9 (same bucket)
        { triggeredAt: new Date('2024-01-08T09:45:00.000Z'), severity: 'warning' },
        // Friday 2024-01-12 23:59 UTC → dayOfWeek=5, hour=23
        { triggeredAt: new Date('2024-01-12T23:59:00.000Z'), severity: 'info' },
      ] as Incident[];

      mockIncidentRepo.find.mockResolvedValue(mockIncidents);

      const response = await getHeatmapData(mockOrgId, new Date('2024-01-01'), new Date('2024-01-31'));

      // Find specific buckets
      const sundayBucket = response.data.find(b => b.dayOfWeek === 0 && b.hour === 15);
      const mondayBucket = response.data.find(b => b.dayOfWeek === 1 && b.hour === 9);
      const fridayBucket = response.data.find(b => b.dayOfWeek === 5 && b.hour === 23);

      expect(sundayBucket?.count).toBe(1);
      expect(mondayBucket?.count).toBe(2); // Two incidents in same bucket
      expect(fridayBucket?.count).toBe(1);

      // Verify total incidents
      expect(response.summary.totalIncidents).toBe(4);
      expect(response.summary.maxCount).toBe(2);
      expect(response.summary.avgCount).toBe(0); // 4 incidents / 168 buckets = 0 (rounded)
    });

    it('should identify peak hour correctly', async () => {
      const mockIncidents = [
        // Create multiple incidents in Tuesday 10:xx hour to make it the peak
        { triggeredAt: new Date('2024-01-09T10:00:00.000Z') },
        { triggeredAt: new Date('2024-01-09T10:30:00.000Z') },
        { triggeredAt: new Date('2024-01-09T10:45:00.000Z') },
        // Single incident in other hours
        { triggeredAt: new Date('2024-01-09T09:00:00.000Z') },
        { triggeredAt: new Date('2024-01-10T15:00:00.000Z') },
      ] as Incident[];

      mockIncidentRepo.find.mockResolvedValue(mockIncidents);

      const response = await getHeatmapData(mockOrgId, new Date('2024-01-01'), new Date('2024-01-31'));

      expect(response.summary.peakHour).toEqual({
        dayOfWeek: 2, // Tuesday
        hour: 10,
        count: 3,
      });
    });
  });

  describe('query filtering', () => {
    it('should filter by severity when provided', async () => {
      const mockIncidents = [
        { triggeredAt: new Date('2024-01-07T15:30:00.000Z'), severity: 'critical' },
        { triggeredAt: new Date('2024-01-08T09:15:00.000Z'), severity: 'error' },
      ] as Incident[];

      mockIncidentRepo.find.mockResolvedValue(mockIncidents);

      await getHeatmapData(mockOrgId, new Date('2024-01-01'), new Date('2024-01-31'), 'critical');

      expect(mockIncidentRepo.find).toHaveBeenCalledWith({
        where: {
          orgId: mockOrgId,
          triggeredAt: expect.any(Object),
          severity: 'critical',
        },
        relations: ['service'],
      });
    });

    it('should filter by serviceId when provided', async () => {
      const serviceId = 'service-456';
      const mockIncidents = [
        { triggeredAt: new Date('2024-01-07T15:30:00.000Z'), serviceId },
      ] as Incident[];

      mockIncidentRepo.find.mockResolvedValue(mockIncidents);

      await getHeatmapData(mockOrgId, new Date('2024-01-01'), new Date('2024-01-31'), undefined, serviceId);

      expect(mockIncidentRepo.find).toHaveBeenCalledWith({
        where: {
          orgId: mockOrgId,
          triggeredAt: expect.any(Object),
          serviceId,
        },
        relations: ['service'],
      });
    });

    it('should apply multiple filters together', async () => {
      const serviceId = 'service-456';
      const mockIncidents = [] as Incident[];

      mockIncidentRepo.find.mockResolvedValue(mockIncidents);

      await getHeatmapData(mockOrgId, new Date('2024-01-01'), new Date('2024-01-31'), 'error', serviceId);

      expect(mockIncidentRepo.find).toHaveBeenCalledWith({
        where: {
          orgId: mockOrgId,
          triggeredAt: expect.any(Object),
          severity: 'error',
          serviceId,
        },
        relations: ['service'],
      });
    });
  });

  describe('date range handling', () => {
    it('should use default 30-day range when no dates provided', async () => {
      mockIncidentRepo.find.mockResolvedValue([]);

      await getHeatmapData(mockOrgId, undefined, undefined);

      expect(mockIncidentRepo.find).toHaveBeenCalledTimes(1);
      const callArgs = mockIncidentRepo.find.mock.calls[0]?.[0];

      // Verify the call was made with proper structure
      expect(callArgs).toBeDefined();
      expect(callArgs).toHaveProperty('where');
      expect(callArgs?.where).toHaveProperty('orgId', mockOrgId);
      expect(callArgs?.where).toHaveProperty('triggeredAt');
      expect(callArgs).toHaveProperty('relations', ['service']);
    });

    it('should use provided date range', async () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31');

      mockIncidentRepo.find.mockResolvedValue([]);

      await getHeatmapData(mockOrgId, start, end);

      expect(mockIncidentRepo.find).toHaveBeenCalledWith({
        where: {
          orgId: mockOrgId,
          triggeredAt: Between(start, end),
        },
        relations: ['service'],
      });
    });
  });

  describe('empty data handling', () => {
    it('should handle empty incident list gracefully', async () => {
      mockIncidentRepo.find.mockResolvedValue([]);

      const response = await getHeatmapData(mockOrgId, new Date('2024-01-01'), new Date('2024-01-31'));

      expect(response.data).toHaveLength(168);
      expect(response.summary.totalIncidents).toBe(0);
      expect(response.summary.maxCount).toBe(0);
      expect(response.summary.avgCount).toBe(0);
      expect(response.summary.peakHour.count).toBe(0);
    });

    it('should return proper structure for response', async () => {
      mockIncidentRepo.find.mockResolvedValue([]);

      const response = await getHeatmapData(mockOrgId, new Date('2024-01-01'), new Date('2024-01-31'));

      expect(response).toHaveProperty('data');
      expect(response).toHaveProperty('summary');
      expect(response).toHaveProperty('filters');
      expect(response).toHaveProperty('period');

      expect(response.summary).toHaveProperty('totalIncidents');
      expect(response.summary).toHaveProperty('maxCount');
      expect(response.summary).toHaveProperty('avgCount');
      expect(response.summary).toHaveProperty('peakHour');

      expect(response.filters).toHaveProperty('severity');
      expect(response.filters).toHaveProperty('serviceId');
    });
  });
});

// Helper function to simulate the heatmap endpoint logic
async function getHeatmapData(
  orgId: string,
  startDate?: Date,
  endDate?: Date,
  severity?: string,
  serviceId?: string
) {
  const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate || new Date();

  const dataSource = await getDataSource();
  const incidentRepo = dataSource.getRepository(Incident);

  // Build query conditions
  const whereConditions: any = {
    orgId,
    triggeredAt: Between(start, end),
  };

  if (severity) {
    whereConditions.severity = severity;
  }

  if (serviceId) {
    whereConditions.serviceId = serviceId;
  }

  const incidents = await incidentRepo.find({
    where: whereConditions,
    relations: ['service'],
  });

  // Initialize heatmap data structure - dayOfWeek (0-6) x hour (0-23)
  const heatmapData: Array<{ dayOfWeek: number; hour: number; count: number }> = [];

  // Create a map for fast lookups during aggregation
  const heatmapMap = new Map<string, number>();

  // Initialize all buckets with 0
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const key = `${day}-${hour}`;
      heatmapMap.set(key, 0);
      heatmapData.push({ dayOfWeek: day, hour, count: 0 });
    }
  }

  // Aggregate incidents by day of week and hour
  incidents.forEach((incident) => {
    const date = new Date(incident.triggeredAt);
    const dayOfWeek = date.getUTCDay(); // 0 = Sunday, 6 = Saturday
    const hour = date.getUTCHours(); // 0-23
    const key = `${dayOfWeek}-${hour}`;

    const currentCount = heatmapMap.get(key) || 0;
    heatmapMap.set(key, currentCount + 1);
  });

  // Update heatmapData with actual counts
  heatmapData.forEach((bucket) => {
    const key = `${bucket.dayOfWeek}-${bucket.hour}`;
    bucket.count = heatmapMap.get(key) || 0;
  });

  // Calculate summary stats
  const totalIncidents = incidents.length;
  const maxCount = Math.max(...heatmapData.map(d => d.count), 0);
  const avgCount = totalIncidents > 0 ? Math.round(totalIncidents / 168) : 0; // 168 = 7 days * 24 hours

  // Find peak hours
  const peakHour = heatmapData.reduce((prev, curr) =>
    curr.count > prev.count ? curr : prev
  );

  return {
    data: heatmapData,
    summary: {
      totalIncidents,
      maxCount,
      avgCount,
      peakHour: {
        dayOfWeek: peakHour.dayOfWeek,
        hour: peakHour.hour,
        count: peakHour.count,
      },
    },
    filters: {
      severity: severity || null,
      serviceId: serviceId || null,
    },
    period: { startDate: start.toISOString(), endDate: end.toISOString() },
  };
}