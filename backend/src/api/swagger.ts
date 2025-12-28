import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'PagerDuty-Lite API',
      version: '1.0.0',
      description: 'A lightweight incident management and on-call alerting system',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:3000',
        description: 'API Server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token from /api/v1/auth/login',
        },
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'Service API key for webhook endpoints',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            fullName: { type: 'string' },
            role: { type: 'string', enum: ['admin', 'user'] },
            phoneNumber: { type: 'string', nullable: true },
            status: { type: 'string', enum: ['active', 'inactive'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Schedule: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string', nullable: true },
            type: { type: 'string', enum: ['manual', 'daily', 'weekly'] },
            timezone: { type: 'string' },
            currentOncallUserId: { type: 'string', format: 'uuid', nullable: true },
            isOverride: { type: 'boolean' },
            overrideUntil: { type: 'string', format: 'date-time', nullable: true },
            rotationConfig: { type: 'object', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Incident: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            incidentNumber: { type: 'integer' },
            summary: { type: 'string' },
            severity: { type: 'string', enum: ['info', 'warning', 'error', 'critical'] },
            state: { type: 'string', enum: ['triggered', 'acknowledged', 'resolved'] },
            triggeredAt: { type: 'string', format: 'date-time' },
            acknowledgedAt: { type: 'string', format: 'date-time', nullable: true },
            resolvedAt: { type: 'string', format: 'date-time', nullable: true },
            details: { type: 'object', nullable: true },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            details: { type: 'string' },
          },
        },
      },
    },
  },
  apis: ['./src/api/routes/*.ts'], // Path to the API routes
};

export const swaggerSpec = swaggerJsdoc(options);
