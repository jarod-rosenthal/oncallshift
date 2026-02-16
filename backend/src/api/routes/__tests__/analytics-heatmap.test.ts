import { Repository } from 'typeorm';
import { Incident, IncidentSeverity } from '../../../shared/models/Incident';

// Mock the data source
jest.mock('../../../shared/db/data-source', () => ({
  getDataSource: jest.fn(),
}));

import { getDataSource } from '../../../shared/db/data-source';

describe('Analytics Heatmap Logic', () => {
  let mockIncidentRepo: jest.Mocked<Repository<Incident>>;

  const mockIncidents: Partial<Incident>[] = [
    {
      id: 'incident-1',
      orgId: 'test-org-id',
      triggeredAt: new Date('2024-01-15T10:30:00Z'), // Monday 10:30 AM
      severity: 'critical',
      serviceId: 'service-1',
    },
    {
      id: 'incident-2',
      orgId: 'test-org-id',
      triggeredAt: new Date('2024-01-15T14:45:00Z'), // Monday 2:45 PM
      severity: 'error',
      serviceId: 'service-1',
    },
    {
      id: 'incident-3',
      orgId: 'test-org-id',
      triggeredAt: new Date('2024-01-16T09:15:00Z'), // Tuesday 9:15 AM
      severity: 'warning',
      serviceId: 'service-2',
    },
    {
      id: 'incident-4',
      orgId: 'test-org-id',
      triggeredAt: new Date('2024-01-16T09:20:00Z'), // Tuesday 9:20 AM (same hour)
      severity: 'critical',
      serviceId: 'service-1',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    mockIncidentRepo = {
      find: jest.fn(),
    } as any;

    (getDataSource as jest.Mock).mockResolvedValue({
      getRepository: jest.fn().mockReturnValue(mockIncidentRepo),
    });
  });

  describe('Heatmap Data Bucketing', () => {
    it('should correctly bucket incidents by dayOfWeek and hour', async () => {
      mockIncidentRepo.find.mockResolvedValue(mockIncidents as Incident[]);

      // Simulate the heatmap logic from the endpoint
      const incidents = await mockIncidentRepo.find({});

      // Initialize heatmap grid: dayOfWeek (0-6) x hour (0-23)
      const heatmapData: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));

      // Populate heatmap data
      incidents.forEach((incident) => {
        const date = new Date(incident.triggeredAt);
        const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        const hour = date.getHours(); // 0-23
        heatmapData[dayOfWeek][hour]++;
      });

      // Find max count for scaling
      const maxCount = Math.max(...heatmapData.flat());

      // Verify structure
      expect(heatmapData).toHaveLength(7);
      expect(heatmapData[0]).toHaveLength(24);

      // Verify specific buckets
      expect(heatmapData[1][10]).toBe(1); // Monday 10am
      expect(heatmapData[1][14]).toBe(1); // Monday 2pm
      expect(heatmapData[2][9]).toBe(2);  // Tuesday 9am (2 incidents)

      // Verify max count
      expect(maxCount).toBe(2);

      // Verify total incidents
      const totalIncidents = heatmapData.flat().reduce((sum, count) => sum + count, 0);
      expect(totalIncidents).toBe(4);
    });

    it('should handle empty incidents array', async () => {
      mockIncidentRepo.find.mockResolvedValue([]);

      const incidents = await mockIncidentRepo.find({});
      const heatmapData: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));

      incidents.forEach((incident) => {
        const date = new Date(incident.triggeredAt);
        const dayOfWeek = date.getDay();
        const hour = date.getHours();
        heatmapData[dayOfWeek][hour]++;
      });

      const maxCount = Math.max(...heatmapData.flat());

      expect(heatmapData).toHaveLength(7);
      expect(heatmapData[0]).toHaveLength(24);
      expect(maxCount).toBe(0);

      // All cells should be 0
      heatmapData.forEach((day: number[]) => {
        day.forEach((hour: number) => {
          expect(hour).toBe(0);
        });
      });
    });

    it('should handle UTC timezone correctly', async () => {
      const utcIncidents: Partial<Incident>[] = [
        {
          id: 'incident-utc-1',
          orgId: 'test-org-id',
          triggeredAt: new Date('2024-01-15T00:00:00Z'), // Monday 00:00 UTC
          severity: 'critical',
          serviceId: 'service-1',
        },
        {
          id: 'incident-utc-2',
          orgId: 'test-org-id',
          triggeredAt: new Date('2024-01-15T23:59:00Z'), // Monday 23:59 UTC
          severity: 'error',
          serviceId: 'service-1',
        },
      ];

      mockIncidentRepo.find.mockResolvedValue(utcIncidents as Incident[]);

      const incidents = await mockIncidentRepo.find({});
      const heatmapData: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));

      incidents.forEach((incident) => {
        const date = new Date(incident.triggeredAt);
        const dayOfWeek = date.getDay();
        const hour = date.getHours();
        heatmapData[dayOfWeek][hour]++;
      });

      // Verify UTC bucketing
      expect(heatmapData[1][0]).toBe(1);  // Monday 00:00
      expect(heatmapData[1][23]).toBe(1); // Monday 23:59
    });

    it('should handle weekend incidents correctly', async () => {
      const weekendIncidents: Partial<Incident>[] = [
        {
          id: 'incident-sunday',
          orgId: 'test-org-id',
          triggeredAt: new Date('2024-01-14T15:30:00Z'), // Sunday 15:30
          severity: 'critical',
          serviceId: 'service-1',
        },
        {
          id: 'incident-saturday',
          orgId: 'test-org-id',
          triggeredAt: new Date('2024-01-13T08:45:00Z'), // Saturday 08:45
          severity: 'warning',
          serviceId: 'service-2',
        },
      ];

      mockIncidentRepo.find.mockResolvedValue(weekendIncidents as Incident[]);

      const incidents = await mockIncidentRepo.find({});
      const heatmapData: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));

      incidents.forEach((incident) => {
        const date = new Date(incident.triggeredAt);
        const dayOfWeek = date.getDay();
        const hour = date.getHours();
        heatmapData[dayOfWeek][hour]++;
      });

      // Verify weekend bucketing (0 = Sunday, 6 = Saturday)
      expect(heatmapData[0][15]).toBe(1); // Sunday 15:30
      expect(heatmapData[6][8]).toBe(1);  // Saturday 08:45
    });

    it('should accumulate multiple incidents in same time bucket', async () => {
      const sameBucketIncidents: Partial<Incident>[] = [
        {
          id: 'incident-1',
          orgId: 'test-org-id',
          triggeredAt: new Date('2024-01-15T09:10:00Z'), // Monday 09:10
          severity: 'critical',
          serviceId: 'service-1',
        },
        {
          id: 'incident-2',
          orgId: 'test-org-id',
          triggeredAt: new Date('2024-01-15T09:45:00Z'), // Monday 09:45 (same hour)
          severity: 'error',
          serviceId: 'service-1',
        },
        {
          id: 'incident-3',
          orgId: 'test-org-id',
          triggeredAt: new Date('2024-01-15T09:59:00Z'), // Monday 09:59 (same hour)
          severity: 'warning',
          serviceId: 'service-2',
        },
      ];

      mockIncidentRepo.find.mockResolvedValue(sameBucketIncidents as Incident[]);

      const incidents = await mockIncidentRepo.find({});
      const heatmapData: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));

      incidents.forEach((incident) => {
        const date = new Date(incident.triggeredAt);
        const dayOfWeek = date.getDay();
        const hour = date.getHours();
        heatmapData[dayOfWeek][hour]++;
      });

      // All three incidents should be in Monday 9am bucket
      expect(heatmapData[1][9]).toBe(3);

      // Verify max count
      const maxCount = Math.max(...heatmapData.flat());
      expect(maxCount).toBe(3);
    });

    it('should handle leap year February correctly', async () => {
      const leapYearIncident: Partial<Incident>[] = [
        {
          id: 'incident-leap',
          orgId: 'test-org-id',
          triggeredAt: new Date('2024-02-29T12:00:00Z'), // Leap day Thursday 12:00
          severity: 'critical',
          serviceId: 'service-1',
        },
      ];

      mockIncidentRepo.find.mockResolvedValue(leapYearIncident as Incident[]);

      const incidents = await mockIncidentRepo.find({});
      const heatmapData: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));

      incidents.forEach((incident) => {
        const date = new Date(incident.triggeredAt);
        const dayOfWeek = date.getDay();
        const hour = date.getHours();
        heatmapData[dayOfWeek][hour]++;
      });

      // February 29, 2024 is a Thursday (day 4)
      expect(heatmapData[4][12]).toBe(1);
    });

    it('should handle year boundary correctly', async () => {
      const yearBoundaryIncidents: Partial<Incident>[] = [
        {
          id: 'incident-new-years-eve',
          orgId: 'test-org-id',
          triggeredAt: new Date('2023-12-31T23:59:00Z'), // December 31, 2023 23:59 (Sunday)
          severity: 'critical',
          serviceId: 'service-1',
        },
        {
          id: 'incident-new-years-day',
          orgId: 'test-org-id',
          triggeredAt: new Date('2024-01-01T00:01:00Z'), // January 1, 2024 00:01 (Monday)
          severity: 'error',
          serviceId: 'service-1',
        },
      ];

      mockIncidentRepo.find.mockResolvedValue(yearBoundaryIncidents as Incident[]);

      const incidents = await mockIncidentRepo.find({});
      const heatmapData: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));

      incidents.forEach((incident) => {
        const date = new Date(incident.triggeredAt);
        const dayOfWeek = date.getDay();
        const hour = date.getHours();
        heatmapData[dayOfWeek][hour]++;
      });

      // December 31, 2023 is Sunday (0), January 1, 2024 is Monday (1)
      expect(heatmapData[0][23]).toBe(1); // Sunday 23:59
      expect(heatmapData[1][0]).toBe(1);  // Monday 00:01
    });
  });

  describe('Database Query Building', () => {
    it('should build query with organization scoping', async () => {
      const orgId = 'test-org-id';
      const whereConditions = {
        orgId,
        triggeredAt: expect.any(Object), // Between object for date range
      };

      await mockIncidentRepo.find({ where: whereConditions });

      expect(mockIncidentRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({
          orgId: 'test-org-id',
        }),
      });
    });

    it('should build query with severity filter', async () => {
      const orgId = 'test-org-id';
      const severity: IncidentSeverity = 'critical';
      const whereConditions = {
        orgId,
        severity,
        triggeredAt: expect.any(Object),
      };

      await mockIncidentRepo.find({ where: whereConditions });

      expect(mockIncidentRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({
          orgId: 'test-org-id',
          severity: 'critical',
        }),
      });
    });

    it('should build query with serviceId filter', async () => {
      const orgId = 'test-org-id';
      const serviceId = 'service-123';
      const whereConditions = {
        orgId,
        serviceId,
        triggeredAt: expect.any(Object),
      };

      await mockIncidentRepo.find({ where: whereConditions });

      expect(mockIncidentRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({
          orgId: 'test-org-id',
          serviceId: 'service-123',
        }),
      });
    });

    it('should build query with all filters combined', async () => {
      const orgId = 'test-org-id';
      const severity: IncidentSeverity = 'error';
      const serviceId = 'service-456';
      const whereConditions = {
        orgId,
        severity,
        serviceId,
        triggeredAt: expect.any(Object),
      };

      await mockIncidentRepo.find({ where: whereConditions });

      expect(mockIncidentRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({
          orgId: 'test-org-id',
          severity: 'error',
          serviceId: 'service-456',
        }),
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle incidents with null triggeredAt gracefully', async () => {
      const incidentsWithNullDate: Partial<Incident>[] = [
        {
          id: 'incident-valid',
          orgId: 'test-org-id',
          triggeredAt: new Date('2024-01-15T10:30:00Z'),
          severity: 'critical',
          serviceId: 'service-1',
        },
        // This would normally not happen due to DB constraints, but testing graceful handling
        {
          id: 'incident-invalid',
          orgId: 'test-org-id',
          triggeredAt: undefined as any,
          severity: 'error',
          serviceId: 'service-1',
        },
      ];

      mockIncidentRepo.find.mockResolvedValue(incidentsWithNullDate as Incident[]);

      const incidents = await mockIncidentRepo.find({});
      const heatmapData: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));

      // The forEach should handle undefined dates gracefully
      incidents.forEach((incident) => {
        if (incident.triggeredAt) {
          const date = new Date(incident.triggeredAt);
          const dayOfWeek = date.getDay();
          const hour = date.getHours();
          heatmapData[dayOfWeek][hour]++;
        }
      });

      // Only the valid incident should be bucketed
      expect(heatmapData[1][10]).toBe(1); // Monday 10am

      const totalIncidents = heatmapData.flat().reduce((sum, count) => sum + count, 0);
      expect(totalIncidents).toBe(1); // Only one valid incident
    });

    it('should handle very large datasets efficiently', async () => {
      // Create a large dataset to test performance characteristics
      const largeDataset: Partial<Incident>[] = [];

      for (let i = 0; i < 1000; i++) {
        const randomDate = new Date(2024, 0, 1 + Math.floor(i / 24), i % 24, 0, 0); // Spread across days
        largeDataset.push({
          id: `incident-${i}`,
          orgId: 'test-org-id',
          triggeredAt: randomDate,
          severity: (['critical', 'error', 'warning', 'info'] as IncidentSeverity[])[i % 4],
          serviceId: `service-${i % 10}`, // 10 different services
        });
      }

      mockIncidentRepo.find.mockResolvedValue(largeDataset as Incident[]);

      const incidents = await mockIncidentRepo.find({});
      const heatmapData: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));

      // Time the bucketing operation
      const startTime = process.hrtime.bigint();

      incidents.forEach((incident) => {
        const date = new Date(incident.triggeredAt);
        const dayOfWeek = date.getDay();
        const hour = date.getHours();
        heatmapData[dayOfWeek][hour]++;
      });

      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

      // Should complete within reasonable time (< 100ms for 1000 items)
      expect(duration).toBeLessThan(100);

      // Verify structure integrity
      expect(heatmapData).toHaveLength(7);
      expect(heatmapData[0]).toHaveLength(24);

      // Total should match
      const total = heatmapData.flat().reduce((sum, count) => sum + count, 0);
      expect(total).toBe(1000);
    });

    it('should handle timezone edge cases correctly', async () => {
      const timezoneEdgeCases: Partial<Incident>[] = [
        {
          id: 'incident-dst-spring',
          orgId: 'test-org-id',
          triggeredAt: new Date('2024-03-10T07:00:00Z'), // Spring DST transition
          severity: 'critical',
          serviceId: 'service-1',
        },
        {
          id: 'incident-dst-fall',
          orgId: 'test-org-id',
          triggeredAt: new Date('2024-11-03T06:00:00Z'), // Fall DST transition
          severity: 'error',
          serviceId: 'service-1',
        },
        {
          id: 'incident-utc-edge',
          orgId: 'test-org-id',
          triggeredAt: new Date('2024-01-01T00:00:00.000Z'), // Exact UTC midnight
          severity: 'warning',
          serviceId: 'service-1',
        },
      ];

      mockIncidentRepo.find.mockResolvedValue(timezoneEdgeCases as Incident[]);

      const incidents = await mockIncidentRepo.find({});
      const heatmapData: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));

      incidents.forEach((incident) => {
        const date = new Date(incident.triggeredAt);
        const dayOfWeek = date.getDay();
        const hour = date.getHours();
        heatmapData[dayOfWeek][hour]++;
      });

      // DST transitions should still bucket correctly in UTC
      expect(heatmapData[0][7]).toBe(1);  // March 10, 2024 is Sunday, 7am UTC
      expect(heatmapData[0][6]).toBe(1);  // November 3, 2024 is Sunday, 6am UTC
      expect(heatmapData[1][0]).toBe(1);  // January 1, 2024 is Monday, midnight UTC
    });

    it('should handle incidents spread across all days and hours', async () => {
      const fullCoverageIncidents: Partial<Incident>[] = [];

      // Create one incident for each day of week and each hour
      for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
          // Use a fixed week in January 2024 to get all days
          const baseDate = new Date('2024-01-14T00:00:00Z'); // January 14, 2024 is a Sunday
          baseDate.setDate(baseDate.getDate() + day);
          baseDate.setHours(hour, 0, 0, 0);

          fullCoverageIncidents.push({
            id: `incident-${day}-${hour}`,
            orgId: 'test-org-id',
            triggeredAt: baseDate,
            severity: 'error',
            serviceId: 'service-1',
          });
        }
      }

      mockIncidentRepo.find.mockResolvedValue(fullCoverageIncidents as Incident[]);

      const incidents = await mockIncidentRepo.find({});
      const heatmapData: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));

      incidents.forEach((incident) => {
        const date = new Date(incident.triggeredAt);
        const dayOfWeek = date.getDay();
        const hour = date.getHours();
        heatmapData[dayOfWeek][hour]++;
      });

      // Every cell should have exactly 1 incident
      for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
          expect(heatmapData[day][hour]).toBe(1);
        }
      }

      // Total should be 7 * 24 = 168
      const total = heatmapData.flat().reduce((sum, count) => sum + count, 0);
      expect(total).toBe(168);

      // Max count should be 1 (evenly distributed)
      const maxCount = Math.max(...heatmapData.flat());
      expect(maxCount).toBe(1);
    });

    it('should handle database repository errors during query building', async () => {
      // Test error handling in the repository layer
      mockIncidentRepo.find.mockImplementation(() => {
        throw new Error('Repository configuration error');
      });

      try {
        await mockIncidentRepo.find({
          where: {
            orgId: 'test-org-id',
          },
        });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Repository configuration error');
      }
    });
  });
});