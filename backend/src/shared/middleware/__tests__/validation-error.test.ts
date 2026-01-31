/**
 * Tests for Validation Error Middleware
 *
 * Verifies that:
 * - Validation errors are caught and formatted correctly
 * - RFC 9457 Problem Details format is used
 * - Field-level error details are provided
 * - Handlers are called when no errors exist
 * - Request ID is included in logs
 */

import { Request, Response, NextFunction } from 'express';
import { body, validationResult as expressValidationResult } from 'express-validator';
import { validationErrorMiddleware, validationHandler } from '../validation-error';
import { logger } from '../../utils/logger';

// Mock express-validator and logger
jest.mock('express-validator');
jest.mock('../../utils/logger');

describe('Validation Error Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      path: '/api/v1/test',
      method: 'POST',
    } as Partial<Request>;

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
    } as Partial<Response>;

    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('when validation errors exist', () => {
    it('should return 400 status with RFC 9457 format', () => {
      const mockErrors = {
        isEmpty: () => false,
        array: () => [
          {
            type: 'field',
            path: 'email',
            msg: 'Invalid email format',
            value: 'not-an-email',
          },
        ],
      };

      (expressValidationResult as unknown as jest.Mock).mockReturnValue(mockErrors);

      validationErrorMiddleware(req as Request, res as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/problem+json');
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();

      const response = (res.json as jest.Mock).mock.calls[0][0];
      expect(response.type).toBe('https://oncallshift.com/problems/validation-error');
      expect(response.title).toBe('Validation Failed');
      expect(response.status).toBe(400);
      expect(response.errors).toBeDefined();
      expect(Array.isArray(response.errors)).toBe(true);
    });

    it('should include field-level error details', () => {
      const mockErrors = {
        isEmpty: () => false,
        array: () => [
          {
            type: 'field',
            path: 'email',
            msg: 'Invalid email format',
            value: 'not-an-email',
          },
          {
            type: 'field',
            path: 'password',
            msg: 'Password must be at least 8 characters',
            value: '123',
          },
        ],
      };

      (expressValidationResult as unknown as jest.Mock).mockReturnValue(mockErrors);

      validationErrorMiddleware(req as Request, res as Response, next);

      const response = (res.json as jest.Mock).mock.calls[0][0];
      expect(response.errors).toHaveLength(2);
      expect(response.errors[0]).toEqual({
        field: 'email',
        message: 'Invalid email format',
        value: 'not-an-email',
      });
      expect(response.errors[1]).toEqual({
        field: 'password',
        message: 'Password must be at least 8 characters',
        value: '123',
      });
    });

    it('should maintain backwards compatibility with validation_errors field', () => {
      const mockErrors = {
        isEmpty: () => false,
        array: () => [
          {
            type: 'field',
            path: 'name',
            msg: 'Name is required',
            value: '',
          },
        ],
      };

      (expressValidationResult as unknown as jest.Mock).mockReturnValue(mockErrors);

      validationErrorMiddleware(req as Request, res as Response, next);

      const response = (res.json as jest.Mock).mock.calls[0][0];
      expect(response.validation_errors).toBeDefined();
      expect(response.validation_errors).toEqual(response.errors);
    });

    it('should log validation errors with request details', () => {
      const mockErrors = {
        isEmpty: () => false,
        array: () => [
          {
            type: 'field',
            path: 'email',
            msg: 'Invalid email',
            value: 'invalid',
          },
        ],
      };

      (expressValidationResult as unknown as jest.Mock).mockReturnValue(mockErrors);
      (req as any).requestId = 'req-123';

      validationErrorMiddleware(req as Request, res as Response, next);

      expect(logger.debug).toHaveBeenCalledWith(
        'Validation errors detected',
        expect.objectContaining({
          requestId: 'req-123',
          endpoint: '/api/v1/test',
          method: 'POST',
          errorCount: 1,
        })
      );
    });

    it('should not call next() when errors exist', () => {
      const mockErrors = {
        isEmpty: () => false,
        array: () => [
          {
            type: 'field',
            path: 'test',
            msg: 'Test error',
          },
        ],
      };

      (expressValidationResult as unknown as jest.Mock).mockReturnValue(mockErrors);

      validationErrorMiddleware(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
    });

    it('should include instance (request URL) in response', () => {
      const mockErrors = {
        isEmpty: () => false,
        array: () => [
          {
            type: 'field',
            path: 'test',
            msg: 'Test error',
          },
        ],
      };

      (expressValidationResult as unknown as jest.Mock).mockReturnValue(mockErrors);
      (req as any).originalUrl = '/api/v1/users?page=1';

      validationErrorMiddleware(req as Request, res as Response, next);

      const response = (res.json as jest.Mock).mock.calls[0][0];
      expect(response.instance).toBe('/api/v1/users?page=1');
    });

    it('should handle non-field validation errors', () => {
      const mockErrors = {
        isEmpty: () => false,
        array: () => [
          {
            type: 'custom',
            msg: 'Custom validation error',
          },
        ],
      };

      (expressValidationResult as unknown as jest.Mock).mockReturnValue(mockErrors);

      validationErrorMiddleware(req as Request, res as Response, next);

      const response = (res.json as jest.Mock).mock.calls[0][0];
      expect(response.errors).toHaveLength(1);
      expect(response.errors[0]).toEqual({
        field: 'unknown',
        message: 'Custom validation error',
      });
    });

    it('should include error backwards-compatibility field', () => {
      const mockErrors = {
        isEmpty: () => false,
        array: () => [
          {
            type: 'field',
            path: 'test',
            msg: 'Test error',
          },
        ],
      };

      (expressValidationResult as unknown as jest.Mock).mockReturnValue(mockErrors);

      validationErrorMiddleware(req as Request, res as Response, next);

      const response = (res.json as jest.Mock).mock.calls[0][0];
      expect(response.error).toBe('One or more fields failed validation');
    });
  });

  describe('when no validation errors exist', () => {
    it('should call next() to continue to handler', () => {
      const mockErrors = {
        isEmpty: () => true,
        array: () => [],
      };

      (expressValidationResult as unknown as jest.Mock).mockReturnValue(mockErrors);

      validationErrorMiddleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should not log when no errors exist', () => {
      const mockErrors = {
        isEmpty: () => true,
        array: () => [],
      };

      (expressValidationResult as unknown as jest.Mock).mockReturnValue(mockErrors);

      validationErrorMiddleware(req as Request, res as Response, next);

      expect(logger.debug).not.toHaveBeenCalled();
    });

    it('should not modify response when no errors exist', () => {
      const mockErrors = {
        isEmpty: () => true,
        array: () => [],
      };

      (expressValidationResult as unknown as jest.Mock).mockReturnValue(mockErrors);

      validationErrorMiddleware(req as Request, res as Response, next);

      expect(res.setHeader).not.toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe('alias exports', () => {
    it('should export validationHandler as alias', () => {
      expect(validationHandler).toBe(validationErrorMiddleware);
    });
  });

  describe('integration with express-validator chains', () => {
    it('should work with body() validation', () => {
      const mockErrors = {
        isEmpty: () => false,
        array: () => [
          {
            type: 'field',
            path: 'email',
            msg: 'Invalid email format',
            value: 'invalid-email',
          },
        ],
      };

      (expressValidationResult as unknown as jest.Mock).mockReturnValue(mockErrors);

      // Simulate: router.post('/', [body('email').isEmail()], validationErrorMiddleware, handler)
      validationErrorMiddleware(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();

      const response = (res.json as jest.Mock).mock.calls[0][0];
      expect(response.errors).toHaveLength(1);
      expect(response.errors[0].field).toBe('email');
    });

    it('should work with query() validation', () => {
      (req as any).method = 'GET';
      (req as any).path = '/api/v1/search?q=';

      const mockErrors = {
        isEmpty: () => false,
        array: () => [
          {
            type: 'field',
            path: 'q',
            msg: 'Search term is required',
            value: '',
          },
        ],
      };

      (expressValidationResult as unknown as jest.Mock).mockReturnValue(mockErrors);

      validationErrorMiddleware(req as Request, res as Response, next);

      const response = (res.json as jest.Mock).mock.calls[0][0];
      expect(response.errors[0].field).toBe('q');
    });

    it('should work with param() validation', () => {
      (req as any).path = '/api/v1/users/invalid-uuid';

      const mockErrors = {
        isEmpty: () => false,
        array: () => [
          {
            type: 'field',
            path: 'id',
            msg: 'Invalid UUID format',
            value: 'invalid-uuid',
          },
        ],
      };

      (expressValidationResult as unknown as jest.Mock).mockReturnValue(mockErrors);

      validationErrorMiddleware(req as Request, res as Response, next);

      const response = (res.json as jest.Mock).mock.calls[0][0];
      expect(response.errors[0].field).toBe('id');
    });
  });

  describe('error details clarity', () => {
    it('should provide clear field names and messages for users', () => {
      const mockErrors = {
        isEmpty: () => false,
        array: () => [
          {
            type: 'field',
            path: 'firstName',
            msg: 'First name must be between 1 and 50 characters',
            value: '',
          },
          {
            type: 'field',
            path: 'email',
            msg: 'Email must be a valid email address',
            value: 'not-email',
          },
          {
            type: 'field',
            path: 'phone',
            msg: 'Phone number must be in format: +1-234-567-8900',
            value: '123',
          },
        ],
      };

      (expressValidationResult as unknown as jest.Mock).mockReturnValue(mockErrors);

      validationErrorMiddleware(req as Request, res as Response, next);

      const response = (res.json as jest.Mock).mock.calls[0][0];

      // Verify each error is clear and actionable
      expect(response.errors[0]).toMatchObject({
        field: 'firstName',
        message: 'First name must be between 1 and 50 characters',
      });
      expect(response.errors[1]).toMatchObject({
        field: 'email',
        message: 'Email must be a valid email address',
      });
      expect(response.errors[2]).toMatchObject({
        field: 'phone',
        message: 'Phone number must be in format: +1-234-567-8900',
      });
    });

    it('should return RFC 9457 compliant problem details structure', () => {
      const mockErrors = {
        isEmpty: () => false,
        array: () => [
          {
            type: 'field',
            path: 'email',
            msg: 'Invalid email',
            value: 'invalid',
          },
        ],
      };

      (expressValidationResult as unknown as jest.Mock).mockReturnValue(mockErrors);
      (req as any).originalUrl = '/api/v1/register';

      validationErrorMiddleware(req as Request, res as Response, next);

      const response = (res.json as jest.Mock).mock.calls[0][0];

      // RFC 9457 required fields
      expect(response).toHaveProperty('type');
      expect(response).toHaveProperty('title');
      expect(response).toHaveProperty('status');
      expect(response).toHaveProperty('instance');

      // Type should be a URI
      expect(response.type).toMatch(/^https?:\/\//);

      // Status should match HTTP response
      expect(response.status).toBe(400);
      expect(res.status).toHaveBeenCalledWith(400);

      // Instance should be the request URL
      expect(response.instance).toBe('/api/v1/register');
    });
  });
});
