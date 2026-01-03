import {
  parsePaginationParams,
  buildPaginationMeta,
  paginatedResponse,
  encodeCursor,
  decodeCursor,
  validateSortField,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  MAX_OFFSET,
  VALID_SORT_FIELDS,
} from '../pagination';

describe('Pagination Utilities', () => {
  describe('parsePaginationParams', () => {
    it('should return default values when no query params provided', () => {
      const result = parsePaginationParams({});

      expect(result.limit).toBe(DEFAULT_LIMIT);
      expect(result.offset).toBe(0);
      expect(result.order).toBe('desc');
    });

    it('should parse limit and offset from query', () => {
      const result = parsePaginationParams({ limit: '50', offset: '100' });

      expect(result.limit).toBe(50);
      expect(result.offset).toBe(100);
    });

    it('should cap limit at MAX_LIMIT', () => {
      const result = parsePaginationParams({ limit: '500' });

      expect(result.limit).toBe(MAX_LIMIT);
    });

    it('should cap offset at MAX_OFFSET', () => {
      const result = parsePaginationParams({ offset: '50000' });

      expect(result.offset).toBe(MAX_OFFSET);
    });

    it('should handle negative values by using minimums', () => {
      const result = parsePaginationParams({ limit: '-10', offset: '-5' });

      expect(result.limit).toBe(1);
      expect(result.offset).toBe(0);
    });

    it('should parse sort and order parameters', () => {
      const result = parsePaginationParams({ sort: 'name', order: 'asc' });

      expect(result.sort).toBe('name');
      expect(result.order).toBe('asc');
    });

    it('should default order to desc', () => {
      const result = parsePaginationParams({ order: 'invalid' });

      expect(result.order).toBe('desc');
    });

    it('should parse cursor parameter', () => {
      const result = parsePaginationParams({ cursor: 'abc123' });

      expect(result.cursor).toBe('abc123');
    });
  });

  describe('buildPaginationMeta', () => {
    it('should calculate hasMore correctly when more results exist', () => {
      const result = buildPaginationMeta(100, 25, 0);

      expect(result.hasMore).toBe(true);
      expect(result.total).toBe(100);
      expect(result.limit).toBe(25);
      expect(result.offset).toBe(0);
    });

    it('should calculate hasMore as false when on last page', () => {
      const result = buildPaginationMeta(100, 25, 75);

      expect(result.hasMore).toBe(false);
    });

    it('should generate nextCursor when hasMore is true and lastItem provided', () => {
      const lastItem = { id: 'item-123', createdAt: new Date('2024-01-01') };
      const result = buildPaginationMeta(100, 25, 0, lastItem);

      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBeDefined();
    });

    it('should not generate nextCursor when no more results', () => {
      const lastItem = { id: 'item-123', createdAt: new Date('2024-01-01') };
      const result = buildPaginationMeta(25, 25, 0, lastItem);

      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeUndefined();
    });
  });

  describe('paginatedResponse', () => {
    it('should return data array with pagination metadata', () => {
      const data = [{ id: '1', name: 'Item 1' }, { id: '2', name: 'Item 2' }];
      const params = { limit: 25, offset: 0 };

      const result = paginatedResponse(data, 2, params);

      expect(result.data).toEqual(data);
      expect(result.pagination).toBeDefined();
      expect(result.pagination.total).toBe(2);
    });

    it('should include legacy key for backwards compatibility', () => {
      const data = [{ id: '1', name: 'Item 1' }];
      const params = { limit: 25, offset: 0 };

      const result = paginatedResponse(data, 1, params, undefined, 'items');

      expect(result.data).toEqual(data);
      expect((result as any).items).toEqual(data);
    });
  });

  describe('Cursor encoding/decoding', () => {
    it('should encode and decode cursor correctly', () => {
      const cursorData = {
        id: 'item-123',
        sortValue: '2024-01-01T00:00:00.000Z',
        offset: 25,
      };

      const encoded = encodeCursor(cursorData);
      const decoded = decodeCursor(encoded);

      expect(decoded).toEqual(cursorData);
    });

    it('should return null for invalid cursor', () => {
      const result = decodeCursor('invalid-cursor');

      expect(result).toBeNull();
    });
  });

  describe('validateSortField', () => {
    it('should return requested field if valid for entity type', () => {
      const result = validateSortField('incidents', 'severity');

      expect(result).toBe('severity');
    });

    it('should return default field if requested field is invalid', () => {
      const result = validateSortField('incidents', 'invalidField');

      expect(result).toBe('createdAt');
    });

    it('should return custom default if provided', () => {
      const result = validateSortField('incidents', 'invalidField', 'triggeredAt');

      expect(result).toBe('triggeredAt');
    });

    it('should return default for unknown entity type', () => {
      const result = validateSortField('unknownEntity', 'name');

      expect(result).toBe('createdAt');
    });
  });

  describe('VALID_SORT_FIELDS', () => {
    it('should have sort fields for all major entity types', () => {
      const entityTypes = [
        'incidents',
        'users',
        'teams',
        'services',
        'schedules',
        'runbooks',
        'escalationPolicies',
        'integrations',
        'notifications',
        'postmortems',
        'reports',
        'workflows',
        'routingRules',
        'tags',
        'businessServices',
        'statusPages',
      ];

      entityTypes.forEach(entityType => {
        expect(VALID_SORT_FIELDS[entityType]).toBeDefined();
        expect(Array.isArray(VALID_SORT_FIELDS[entityType])).toBe(true);
        expect(VALID_SORT_FIELDS[entityType].length).toBeGreaterThan(0);
      });
    });

    it('should include createdAt for most entity types', () => {
      const entityTypes = Object.keys(VALID_SORT_FIELDS);

      entityTypes.forEach(entityType => {
        // Most entities should have createdAt as a valid sort field
        if (!['incidents', 'incidentEvents'].includes(entityType)) {
          expect(VALID_SORT_FIELDS[entityType]).toContain('createdAt');
        }
      });
    });
  });
});
