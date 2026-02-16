import { Repository } from 'typeorm';
import { Incident } from '../../../shared/models/Incident';

// Mock the data source
jest.mock('../../../shared/db/data-source', () => ({
  getDataSource: jest.fn(),
}));

// Mock express-validator
jest.mock('express-validator', () => ({
  validationResult: jest.fn(),
  query: jest.fn().mockReturnThis(),
}));

import { getDataSource } from '../../../shared/db/data-source';
import { validationResult } from 'express-validator';
import request from 'supertest';
import express from 'express';
import router from '../analytics';

const app = express();
app.use(express.json());

// Mock authentication middleware
app.use((req: any, res, next) => {
  req.orgId = 'test-org-id';
  req.user = { id: 'test-user-id' };
  req.organization = { id: 'test-org-id' };
  next();
});

app.use('/analytics', router);

describe('Analytics Heatmap Endpoint', () => {
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

    (validationResult as jest.Mock).mockReturnValue({
      isEmpty: () => true,
      array: () => [],
    });
  });

  describe('GET /analytics/heatmap', () => {
    it('should return heatmap data with correct bucketing', async () => {
      mockIncidentRepo.find.mockResolvedValue(mockIncidents as Incident[]);

      const response = await request(app).get('/analytics/heatmap');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('heatmapData');
      expect(response.body).toHaveProperty('maxCount');
      expect(response.body).toHaveProperty('totalIncidents');
      expect(response.body).toHaveProperty('period');

      // Check heatmap structure (7 days x 24 hours)
      expect(response.body.heatmapData).toHaveLength(7);
      expect(response.body.heatmapData[0]).toHaveLength(24);

      // Check total incidents
      expect(response.body.totalIncidents).toBe(4);

      // Check max count (should be 2, as Tuesday 9am has 2 incidents)
      expect(response.body.maxCount).toBe(2);

      // Verify bucketing logic:
      // Monday (1) at hour 10: 1 incident, hour 14: 1 incident
      // Tuesday (2) at hour 9: 2 incidents
      expect(response.body.heatmapData[1][10]).toBe(1); // Monday 10am
      expect(response.body.heatmapData[1][14]).toBe(1); // Monday 2pm
      expect(response.body.heatmapData[2][9]).toBe(2);  // Tuesday 9am
    });

    it('should handle empty data correctly', async () => {
      mockIncidentRepo.find.mockResolvedValue([]);

      const response = await request(app).get('/analytics/heatmap');

      expect(response.status).toBe(200);
      expect(response.body.heatmapData).toHaveLength(7);
      expect(response.body.heatmapData[0]).toHaveLength(24);
      expect(response.body.totalIncidents).toBe(0);
      expect(response.body.maxCount).toBe(0);

      // All cells should be 0
      response.body.heatmapData.forEach((day: number[]) => {
        day.forEach((hour: number) => {
          expect(hour).toBe(0);
        });
      });
    });

    it('should filter by severity when provided', async () => {
      mockIncidentRepo.find.mockResolvedValue(
        mockIncidents.filter(i => i.severity === 'critical') as Incident[]
      );

      const response = await request(app)
        .get('/analytics/heatmap')
        .query({ severity: 'critical' });

      expect(response.status).toBe(200);
      expect(response.body.totalIncidents).toBe(2);
      expect(response.body.filters.severity).toBe('critical');

      // Verify the repository was called with the correct filter
      expect(mockIncidentRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({
          orgId: 'test-org-id',
          severity: 'critical',
        }),
      });
    });

    it('should filter by serviceId when provided', async () => {
      mockIncidentRepo.find.mockResolvedValue(
        mockIncidents.filter(i => i.serviceId === 'service-1') as Incident[]
      );

      const response = await request(app)
        .get('/analytics/heatmap')
        .query({ serviceId: 'service-1' });

      expect(response.status).toBe(200);
      expect(response.body.totalIncidents).toBe(3);
      expect(response.body.filters.serviceId).toBe('service-1');

      // Verify the repository was called with the correct filter
      expect(mockIncidentRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({
          orgId: 'test-org-id',
          serviceId: 'service-1',
        }),
      });
    });

    it('should handle date range filtering', async () => {
      mockIncidentRepo.find.mockResolvedValue(mockIncidents as Incident[]);

      const response = await request(app)
        .get('/analytics/heatmap')
        .query({
          startDate: '2024-01-01T00:00:00Z',
          endDate: '2024-01-31T23:59:59Z',
        });

      expect(response.status).toBe(200);
      expect(response.body.period).toHaveProperty('startDate');
      expect(response.body.period).toHaveProperty('endDate');

      // Verify the repository was called with date range
      expect(mockIncidentRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({
          orgId: 'test-org-id',
          triggeredAt: expect.any(Object),
        }),
      });
    });

    it('should return 400 for invalid query parameters', async () => {
      (validationResult as jest.Mock).mockReturnValue({
        isEmpty: () => false,
        array: () => [{ msg: 'Invalid date format' }],
      });

      const response = await request(app)
        .get('/analytics/heatmap')
        .query({ startDate: 'invalid-date' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    });

    it('should handle database errors gracefully', async () => {
      mockIncidentRepo.find.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/analytics/heatmap');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to fetch analytics heatmap' });
    });

    it('should scope queries by organization', async () => {
      mockIncidentRepo.find.mockResolvedValue([]);

      await request(app).get('/analytics/heatmap');

      // Verify the repository was called with the correct org scoping
      expect(mockIncidentRepo.find).toHaveBeenCalledWith({
        where: expect.objectContaining({
          orgId: 'test-org-id',
        }),
      });
    });
  });
});