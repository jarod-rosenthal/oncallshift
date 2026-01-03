import { Response } from 'express';
import {
  problemResponse,
  badRequest,
  validationError,
  unauthorized,
  forbidden,
  notFound,
  methodNotAllowed,
  conflict,
  gone,
  unprocessableEntity,
  rateLimited,
  idempotencyConflict,
  internalError,
  notImplemented,
  serviceUnavailable,
  gatewayTimeout,
  quotaExceeded,
  resourceLocked,
  dependencyFailed,
  fromExpressValidator,
  PROBLEM_TYPES,
  ValidationError,
} from '../problem-details';

// Mock Express Response
function createMockResponse(): Response {
  const res: Partial<Response> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    req: { originalUrl: '/api/v1/test' } as any,
  };
  return res as Response;
}

describe('RFC 9457 Problem Details', () => {
  describe('problemResponse', () => {
    it('should set Content-Type to application/problem+json', () => {
      const res = createMockResponse();

      problemResponse(res, 400, PROBLEM_TYPES.BAD_REQUEST, 'Bad Request', 'Test detail');

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/problem+json');
    });

    it('should include all required RFC 9457 fields', () => {
      const res = createMockResponse();

      problemResponse(res, 400, PROBLEM_TYPES.BAD_REQUEST, 'Bad Request', 'Test detail');

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          type: PROBLEM_TYPES.BAD_REQUEST,
          title: 'Bad Request',
          status: 400,
          detail: 'Test detail',
          instance: '/api/v1/test',
        })
      );
    });

    it('should include backwards-compatible error field', () => {
      const res = createMockResponse();

      problemResponse(res, 400, PROBLEM_TYPES.BAD_REQUEST, 'Bad Request', 'Test detail');

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Test detail',
        })
      );
    });

    it('should include extras in response', () => {
      const res = createMockResponse();

      problemResponse(res, 400, PROBLEM_TYPES.BAD_REQUEST, 'Bad Request', 'Test', {
        customField: 'value',
      });

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          customField: 'value',
        })
      );
    });
  });

  describe('Client Error Functions (4xx)', () => {
    describe('badRequest', () => {
      it('should return 400 with correct type', () => {
        const res = createMockResponse();

        badRequest(res, 'Invalid input');

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            type: PROBLEM_TYPES.BAD_REQUEST,
            title: 'Bad Request',
          })
        );
      });
    });

    describe('validationError', () => {
      it('should return 400 with validation errors array', () => {
        const res = createMockResponse();
        const errors: ValidationError[] = [
          { field: 'email', message: 'Invalid email format' },
          { field: 'name', message: 'Name is required', value: '' },
        ];

        validationError(res, errors);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            type: PROBLEM_TYPES.VALIDATION_ERROR,
            title: 'Validation Failed',
            errors,
            validation_errors: errors,
          })
        );
      });
    });

    describe('unauthorized', () => {
      it('should return 401', () => {
        const res = createMockResponse();

        unauthorized(res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            type: PROBLEM_TYPES.UNAUTHORIZED,
            title: 'Unauthorized',
          })
        );
      });

      it('should use custom detail message', () => {
        const res = createMockResponse();

        unauthorized(res, 'Token expired');

        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            detail: 'Token expired',
          })
        );
      });
    });

    describe('forbidden', () => {
      it('should return 403', () => {
        const res = createMockResponse();

        forbidden(res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            type: PROBLEM_TYPES.FORBIDDEN,
            title: 'Forbidden',
          })
        );
      });
    });

    describe('notFound', () => {
      it('should return 404 with resource details', () => {
        const res = createMockResponse();

        notFound(res, 'User', 'user-123');

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            type: PROBLEM_TYPES.NOT_FOUND,
            title: 'Resource Not Found',
            detail: "User with ID 'user-123' was not found",
            resource: 'User',
            resourceId: 'user-123',
          })
        );
      });

      it('should work without ID', () => {
        const res = createMockResponse();

        notFound(res, 'Configuration');

        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            detail: 'Configuration was not found',
            resource: 'Configuration',
          })
        );
      });
    });

    describe('methodNotAllowed', () => {
      it('should return 405 and set Allow header', () => {
        const res = createMockResponse();

        methodNotAllowed(res, ['GET', 'POST']);

        expect(res.status).toHaveBeenCalledWith(405);
        expect(res.setHeader).toHaveBeenCalledWith('Allow', 'GET, POST');
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            allowedMethods: ['GET', 'POST'],
          })
        );
      });
    });

    describe('conflict', () => {
      it('should return 409', () => {
        const res = createMockResponse();

        conflict(res, 'Resource already exists');

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            type: PROBLEM_TYPES.CONFLICT,
            title: 'Conflict',
          })
        );
      });
    });

    describe('gone', () => {
      it('should return 410', () => {
        const res = createMockResponse();

        gone(res, 'Subscription');

        expect(res.status).toHaveBeenCalledWith(410);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            type: PROBLEM_TYPES.GONE,
            resource: 'Subscription',
          })
        );
      });
    });

    describe('unprocessableEntity', () => {
      it('should return 422', () => {
        const res = createMockResponse();

        unprocessableEntity(res, 'Cannot process this request');

        expect(res.status).toHaveBeenCalledWith(422);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            type: PROBLEM_TYPES.UNPROCESSABLE_ENTITY,
          })
        );
      });
    });

    describe('rateLimited', () => {
      it('should return 429 and set Retry-After header', () => {
        const res = createMockResponse();

        rateLimited(res, 60);

        expect(res.status).toHaveBeenCalledWith(429);
        expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '60');
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            retryAfter: 60,
          })
        );
      });
    });

    describe('idempotencyConflict', () => {
      it('should return 422', () => {
        const res = createMockResponse();

        idempotencyConflict(res);

        expect(res.status).toHaveBeenCalledWith(422);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            type: PROBLEM_TYPES.IDEMPOTENCY_CONFLICT,
          })
        );
      });
    });
  });

  describe('Server Error Functions (5xx)', () => {
    describe('internalError', () => {
      it('should return 500', () => {
        const res = createMockResponse();

        internalError(res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            type: PROBLEM_TYPES.INTERNAL_ERROR,
            title: 'Internal Server Error',
          })
        );
      });

      it('should include request ID if provided', () => {
        const res = createMockResponse();

        internalError(res, 'req-abc-123');

        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            requestId: 'req-abc-123',
          })
        );
      });
    });

    describe('notImplemented', () => {
      it('should return 501', () => {
        const res = createMockResponse();

        notImplemented(res, 'bulk export');

        expect(res.status).toHaveBeenCalledWith(501);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            type: PROBLEM_TYPES.NOT_IMPLEMENTED,
            detail: 'The bulk export feature is not yet implemented',
          })
        );
      });
    });

    describe('serviceUnavailable', () => {
      it('should return 503', () => {
        const res = createMockResponse();

        serviceUnavailable(res);

        expect(res.status).toHaveBeenCalledWith(503);
      });

      it('should set Retry-After header if provided', () => {
        const res = createMockResponse();

        serviceUnavailable(res, 120);

        expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '120');
      });
    });

    describe('gatewayTimeout', () => {
      it('should return 504', () => {
        const res = createMockResponse();

        gatewayTimeout(res);

        expect(res.status).toHaveBeenCalledWith(504);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            type: PROBLEM_TYPES.GATEWAY_TIMEOUT,
          })
        );
      });
    });
  });

  describe('Business Logic Error Functions', () => {
    describe('quotaExceeded', () => {
      it('should return 403 with quota details', () => {
        const res = createMockResponse();

        quotaExceeded(res, 'incidents', 100, 100);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            type: PROBLEM_TYPES.QUOTA_EXCEEDED,
            resource: 'incidents',
            limit: 100,
            current: 100,
          })
        );
      });
    });

    describe('resourceLocked', () => {
      it('should return 423', () => {
        const res = createMockResponse();

        resourceLocked(res, 'Incident');

        expect(res.status).toHaveBeenCalledWith(423);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            type: PROBLEM_TYPES.RESOURCE_LOCKED,
            resource: 'Incident',
          })
        );
      });
    });

    describe('dependencyFailed', () => {
      it('should return 424', () => {
        const res = createMockResponse();

        dependencyFailed(res, 'email-service', 'Email service is down');

        expect(res.status).toHaveBeenCalledWith(424);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            type: PROBLEM_TYPES.DEPENDENCY_FAILED,
            dependency: 'email-service',
          })
        );
      });
    });
  });

  describe('fromExpressValidator', () => {
    it('should convert field errors to ValidationError format', () => {
      const expressErrors = [
        {
          type: 'field' as const,
          path: 'email',
          msg: 'Invalid email format',
          value: 'not-an-email',
          location: 'body' as const,
        },
        {
          type: 'field' as const,
          path: 'name',
          msg: 'Name is required',
          value: '',
          location: 'body' as const,
        },
      ];

      const result = fromExpressValidator(expressErrors);

      expect(result).toEqual([
        { field: 'email', message: 'Invalid email format', value: 'not-an-email' },
        { field: 'name', message: 'Name is required', value: '' },
      ]);
    });

    it('should handle non-field errors', () => {
      const expressErrors = [
        {
          type: 'alternative' as const,
          msg: 'At least one field is required',
          nestedErrors: [],
        },
      ];

      const result = fromExpressValidator(expressErrors as any);

      expect(result).toEqual([
        { field: 'unknown', message: 'At least one field is required' },
      ]);
    });
  });

  describe('PROBLEM_TYPES', () => {
    it('should have correct base URI', () => {
      expect(PROBLEM_TYPES.BAD_REQUEST).toBe('https://oncallshift.com/problems/bad-request');
    });

    it('should have all expected problem types', () => {
      const expectedTypes = [
        'BAD_REQUEST',
        'VALIDATION_ERROR',
        'UNAUTHORIZED',
        'FORBIDDEN',
        'NOT_FOUND',
        'METHOD_NOT_ALLOWED',
        'CONFLICT',
        'GONE',
        'UNPROCESSABLE_ENTITY',
        'RATE_LIMITED',
        'IDEMPOTENCY_CONFLICT',
        'INTERNAL_ERROR',
        'NOT_IMPLEMENTED',
        'SERVICE_UNAVAILABLE',
        'GATEWAY_TIMEOUT',
        'QUOTA_EXCEEDED',
        'PAYMENT_REQUIRED',
        'RESOURCE_LOCKED',
        'DEPENDENCY_FAILED',
      ];

      expectedTypes.forEach(type => {
        expect(PROBLEM_TYPES).toHaveProperty(type);
      });
    });
  });
});
