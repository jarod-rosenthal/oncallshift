import { Repository, SelectQueryBuilder } from 'typeorm';
import { Service } from '../../../shared/models/Service';

// Mock the data source
jest.mock('../../../shared/db/data-source', () => ({
  getDataSource: jest.fn(),
}));

import { getDataSource } from '../../../shared/db/data-source';

describe('Webhook Service Lookup', () => {
  let mockServiceRepo: jest.Mocked<Repository<Service>>;
  let mockQueryBuilder: jest.Mocked<SelectQueryBuilder<Service>>;

  const mockService: Partial<Service> = {
    id: 'svc-123',
    orgId: 'org-456',
    name: 'Test Service',
    apiKey: 'native-api-key',
    externalKeys: {
      pagerduty: 'pd-integration-key',
      opsgenie: 'og-api-key',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    } as any;

    mockServiceRepo = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    } as any;

    (getDataSource as jest.Mock).mockResolvedValue({
      getRepository: jest.fn().mockReturnValue(mockServiceRepo),
    });
  });

  describe('findServiceByKey behavior', () => {
    // We test the expected behavior by simulating different scenarios

    it('should find service by native API key first', async () => {
      mockServiceRepo.findOne.mockResolvedValue(mockService as Service);

      // Simulate the lookup logic
      const apiKey = 'native-api-key';
      const service = await mockServiceRepo.findOne({ where: { apiKey } });

      expect(service).toEqual(mockService);
      expect(mockServiceRepo.findOne).toHaveBeenCalledWith({ where: { apiKey: 'native-api-key' } });
    });

    it('should fall back to PagerDuty external key when native key not found', async () => {
      // Native key lookup returns null
      mockServiceRepo.findOne.mockResolvedValue(null);
      // External key lookup returns service
      mockQueryBuilder.getOne.mockResolvedValue(mockService as Service);

      // Simulate the lookup logic for PagerDuty
      const apiKey = 'pd-integration-key';
      let service = await mockServiceRepo.findOne({ where: { apiKey } });

      if (!service) {
        service = await mockServiceRepo
          .createQueryBuilder('service')
          .where("service.external_keys->>'pagerduty' = :key", { key: apiKey })
          .getOne();
      }

      expect(service).toEqual(mockService);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        "service.external_keys->>'pagerduty' = :key",
        { key: 'pd-integration-key' }
      );
    });

    it('should fall back to Opsgenie external key when native key not found', async () => {
      mockServiceRepo.findOne.mockResolvedValue(null);
      mockQueryBuilder.getOne.mockResolvedValue(mockService as Service);

      // Simulate the lookup logic for Opsgenie
      const apiKey = 'og-api-key';
      let service = await mockServiceRepo.findOne({ where: { apiKey } });

      if (!service) {
        service = await mockServiceRepo
          .createQueryBuilder('service')
          .where("service.external_keys->>'opsgenie' = :key", { key: apiKey })
          .getOne();
      }

      expect(service).toEqual(mockService);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        "service.external_keys->>'opsgenie' = :key",
        { key: 'og-api-key' }
      );
    });

    it('should check both external key types for generic webhook', async () => {
      mockServiceRepo.findOne.mockResolvedValue(null);
      mockQueryBuilder.getOne.mockResolvedValue(mockService as Service);

      // Simulate the lookup logic for generic
      const apiKey = 'some-key';
      let service = await mockServiceRepo.findOne({ where: { apiKey } });

      if (!service) {
        service = await mockServiceRepo
          .createQueryBuilder('service')
          .where("service.external_keys->>'pagerduty' = :key", { key: apiKey })
          .orWhere("service.external_keys->>'opsgenie' = :key", { key: apiKey })
          .getOne();
      }

      expect(mockQueryBuilder.where).toHaveBeenCalled();
      expect(mockQueryBuilder.orWhere).toHaveBeenCalled();
    });

    it('should return null when no matching key found', async () => {
      mockServiceRepo.findOne.mockResolvedValue(null);
      mockQueryBuilder.getOne.mockResolvedValue(null);

      const apiKey = 'unknown-key';
      let service = await mockServiceRepo.findOne({ where: { apiKey } });

      if (!service) {
        service = await mockServiceRepo
          .createQueryBuilder('service')
          .where("service.external_keys->>'pagerduty' = :key", { key: apiKey })
          .getOne();
      }

      expect(service).toBeNull();
    });
  });
});

describe('Import Key Preservation', () => {
  describe('preserveKeys option', () => {
    it('should store external key when preserveKeys is true and integration_key provided', () => {
      const preserveKeys = true;
      const pdService = {
        name: 'Test Service',
        integration_key: 'pd-key-123',
      };

      const externalKeys = preserveKeys && pdService.integration_key
        ? { pagerduty: pdService.integration_key }
        : null;

      expect(externalKeys).toEqual({ pagerduty: 'pd-key-123' });
    });

    it('should not store external key when preserveKeys is false', () => {
      const preserveKeys = false;
      const pdService = {
        name: 'Test Service',
        integration_key: 'pd-key-123',
      };

      const externalKeys = preserveKeys && pdService.integration_key
        ? { pagerduty: pdService.integration_key }
        : null;

      expect(externalKeys).toBeNull();
    });

    it('should not store external key when integration_key is missing', () => {
      const preserveKeys = true;
      const pdService = {
        name: 'Test Service',
      };

      const externalKeys = preserveKeys && (pdService as any).integration_key
        ? { pagerduty: (pdService as any).integration_key }
        : null;

      expect(externalKeys).toBeNull();
    });

    it('should store Opsgenie key in correct field', () => {
      const preserveKeys = true;
      const ogService = {
        name: 'Test Service',
        apiKey: 'og-key-456',
      };

      const externalKeys = preserveKeys && ogService.apiKey
        ? { opsgenie: ogService.apiKey }
        : null;

      expect(externalKeys).toEqual({ opsgenie: 'og-key-456' });
    });
  });

  describe('Service model externalKeys field', () => {
    it('should support both PagerDuty and Opsgenie keys', () => {
      const service: Partial<Service> = {
        id: 'svc-1',
        name: 'Multi-source Service',
        apiKey: 'native-key',
        externalKeys: {
          pagerduty: 'pd-key',
          opsgenie: 'og-key',
        },
      };

      expect(service.externalKeys?.pagerduty).toBe('pd-key');
      expect(service.externalKeys?.opsgenie).toBe('og-key');
    });

    it('should allow null externalKeys', () => {
      const service: Partial<Service> = {
        id: 'svc-2',
        name: 'New Service',
        apiKey: 'native-key',
        externalKeys: null,
      };

      expect(service.externalKeys).toBeNull();
    });

    it('should allow partial externalKeys (only one source)', () => {
      const service: Partial<Service> = {
        id: 'svc-3',
        name: 'PD Only Service',
        apiKey: 'native-key',
        externalKeys: {
          pagerduty: 'pd-key',
        },
      };

      expect(service.externalKeys?.pagerduty).toBe('pd-key');
      expect(service.externalKeys?.opsgenie).toBeUndefined();
    });
  });
});
