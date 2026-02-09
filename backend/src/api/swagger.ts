import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "OnCallShift API",
      version: "1.0.0",
      description: "Incident management platform API",
      contact: {
        name: "OnCallShift",
        url: "https://oncallshift.com",
      },
    },
    servers: [
      {
        url: "/api/v1",
        description: "API v1",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
        apiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "Authorization",
          description: "Organization API key (org_*) or Service API key (svc_*)",
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ["./src/api/routes/*.ts", "./src/api/routes/*.js"],
};

export const swaggerSpec = swaggerJsdoc(options);
