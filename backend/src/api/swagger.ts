import swaggerJsdoc from 'swagger-jsdoc';
import { modelSchemas } from './schemas/models';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'OnCallShift API',
      version: '1.0.0',
      description: 'A production incident management and on-call alerting platform',
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
      schemas: modelSchemas,
      responses: {
        UnauthorizedError: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UnauthorizedError' },
            },
          },
        },
        ForbiddenError: {
          description: 'Permission denied',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ForbiddenError' },
            },
          },
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/NotFoundError' },
            },
          },
        },
        ValidationError: {
          description: 'Validation failed',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ValidationError' },
            },
          },
        },
      },
    },
    tags: [
      { name: 'Authentication', description: 'User authentication and session management' },
      { name: 'Users', description: 'User management operations' },
      { name: 'Teams', description: 'Team management operations' },
      { name: 'Services', description: 'Service management operations' },
      { name: 'Escalation Policies', description: 'Escalation policy management' },
      { name: 'Schedules', description: 'On-call schedule management' },
      { name: 'Incidents', description: 'Incident management operations' },
      { name: 'Alerts', description: 'Alert ingestion and management' },
      { name: 'Runbooks', description: 'Runbook management and execution' },
      { name: 'Integrations', description: 'Third-party integrations' },
      { name: 'Tags', description: 'Tag management' },
      { name: 'Notifications', description: 'Notification delivery and tracking' },
      { name: 'AI', description: 'AI-powered features (diagnosis, assistant)' },
    ],
  },
  apis: ['./src/api/routes/*.ts'], // Path to the API routes
};

export const swaggerSpec = swaggerJsdoc(options);
