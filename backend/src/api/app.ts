import express, { Express, Request, Response, NextFunction } from 'express';
import path from 'path';
import helmet from 'helmet';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger';
import { logger } from '../shared/utils/logger';
import { Sentry, isSentryEnabled } from '../shared/config/sentry';

// Import routes
import authRoutes from './routes/auth';
import alertRoutes from './routes/alerts';
import alertsCompatRoutes from './routes/alerts-compat';
import incidentRoutes from './routes/incidents';
import scheduleRoutes from './routes/schedules';
import escalationPoliciesRoutes from './routes/escalation-policies';
import serviceRoutes from './routes/services';
import deviceRoutes from './routes/devices';
import userRoutes from './routes/users';
import notificationRoutes from './routes/notifications';
import demoRoutes from './routes/demo';
import aiDiagnosisRoutes from './routes/ai-diagnosis';
import runbookRoutes from './routes/runbooks';
import actionsRoutes from './routes/actions';
import setupRoutes from './routes/setup';
import integrationsRoutes from './routes/integrations';
import teamsRoutes from './routes/teams';
import routingRulesRoutes from './routes/routing-rules';
import prioritiesRoutes from './routes/priorities';
import businessServicesRoutes from './routes/business-services';
import tagsRoutes from './routes/tags';
import webhooksRoutes from './routes/webhooks';
import importRoutes from './routes/import';
import exportRoutes from './routes/export';
import semanticImportRoutes from './routes/semantic-import';
import heartbeatsRoutes from './routes/heartbeats';
import statusPagesRoutes from './routes/status-pages';
import workflowsRoutes from './routes/workflows';
import webhookSubscriptionsRoutes from './routes/webhook-subscriptions';
import reportsRoutes from './routes/reports';
import conferenceBridgesRoutes from './routes/conference-bridges';
import analyticsRoutes from './routes/analytics';
import postmortemsRoutes from './routes/postmortems';
import cloudCredentialsRoutes from './routes/cloud-credentials';
import aiAssistantRoutes from './routes/ai-assistant';
import runbookAutomationRoutes from './routes/runbook-automation';
import aiConfigurationRoutes from './routes/ai-configuration';
import aiRecommendationsRoutes from './routes/ai-recommendations';
import apiKeysRoutes from './routes/api-keys';
import onboardingRoutes from './routes/onboarding';
import aiWorkersRoutes from './routes/ai-workers';
import aiWorkerTasksRoutes from './routes/ai-worker-tasks';
import aiWorkerApprovalsRoutes from './routes/ai-worker-approvals';
import aiWorkerWebhooksRoutes from './routes/ai-worker-webhooks';
import superAdminRoutes from './routes/super-admin';
import { captureRawBody, etagMiddleware } from '../shared/middleware';
import { idempotencyMiddleware } from '../shared/middleware/idempotency';
import { requestIdMiddleware } from '../shared/middleware/request-id';
import { methodBasedRateLimiter, expensiveRateLimiter, bulkRateLimiter } from '../shared/middleware/rate-limiter';

export function createApp(): Express {
  const app = express();

  // Security middleware - allow inline scripts for demo page and React app
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "script-src": ["'self'", "'unsafe-inline'"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:", "blob:", "https://pagerduty-lite-dev-uploads.s3.us-east-1.amazonaws.com", "https://api.dicebear.com"],
        "connect-src": ["'self'", "https://api.oncallshift.com", "https://api.anthropic.com", "http://localhost:3000"],
        "upgrade-insecure-requests": null, // Disable for demo (no SSL certificate)
      },
    },
  }));

  // CORS
  app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  }));

  // Body parsing - capture raw body for webhook signature verification
  app.use(express.json({ limit: '10mb', verify: captureRawBody }));
  app.use(express.urlencoded({ extended: true }));

  // Request ID middleware - adds unique ID to each request for tracing
  app.use(requestIdMiddleware);

  // Request logging
  app.use((req, _res, next) => {
    logger.info(`${req.method} ${req.path}`, {
      method: req.method,
      path: req.path,
      query: req.query,
      ip: req.ip,
    });
    next();
  });

  // ETag middleware for HTTP caching (RFC 7232)
  // Adds ETag headers to GET responses and handles If-None-Match/If-Match
  app.use(etagMiddleware());

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'oncallshift-api',
    });
  });


  // Swagger API Documentation
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'OnCallShift API Docs',
  }));

  // Demo dashboard - serve HTML at /demo
  app.get('/demo', (_req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OnCallShift Live Demo</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        header { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px; }
        h1 { color: #2c3e50; font-size: 28px; margin-bottom: 10px; }
        .status-badge { display: inline-block; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; margin-left: 10px; }
        .status-live { background: #e8f5e9; color: #2e7d32; }
        .status-error { background: #ffebee; color: #c62828; }
        .refresh-btn { background: #3498db; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-size: 14px; margin-top: 10px; font-weight: 600; }
        .refresh-btn:hover { background: #2980b9; }
        .refresh-btn:disabled { background: #95a5a6; cursor: not-allowed; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .stat-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .stat-label { color: #7f8c8d; font-size: 12px; text-transform: uppercase; margin-bottom: 8px; }
        .stat-value { font-size: 32px; font-weight: bold; color: #2c3e50; }
        .stat-critical { color: #e74c3c; }
        .stat-warning { color: #f39c12; }
        .stat-success { color: #27ae60; }
        .incidents { background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden; margin-bottom: 20px; }
        .incidents-header { padding: 20px; border-bottom: 1px solid #ecf0f1; display: flex; justify-content: space-between; align-items: center; }
        .incidents-header h2 { color: #2c3e50; font-size: 20px; }
        .last-updated { font-size: 12px; color: #95a5a6; }
        .incident { padding: 20px; border-bottom: 1px solid #ecf0f1; transition: background 0.2s; }
        .incident:hover { background: #f8f9fa; }
        .incident-header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px; }
        .incident-title { font-size: 18px; font-weight: 600; color: #2c3e50; margin-bottom: 5px; }
        .incident-number { font-size: 14px; color: #7f8c8d; }
        .badges { display: flex; gap: 8px; flex-wrap: wrap; }
        .badge { padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
        .badge-critical { background: #ffeaea; color: #e74c3c; }
        .badge-warning { background: #fff8e1; color: #f39c12; }
        .badge-info { background: #e3f2fd; color: #3498db; }
        .badge-triggered { background: #ffebee; color: #c62828; }
        .badge-acknowledged { background: #fff3e0; color: #ef6c00; }
        .badge-resolved { background: #e8f5e9; color: #2e7d32; }
        .incident-details { color: #7f8c8d; font-size: 14px; margin-top: 10px; }
        .incident-meta { margin-top: 10px; display: flex; gap: 20px; font-size: 13px; color: #95a5a6; flex-wrap: wrap; }
        .loading { text-align: center; padding: 40px; color: #7f8c8d; }
        .loading-spinner { display: inline-block; width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 10px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .error { background: #ffebee; color: #c62828; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .oncall-section { background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); padding: 20px; margin-bottom: 20px; }
        .oncall-section h3 { color: #2c3e50; margin-bottom: 15px; font-size: 18px; }
        .oncall-card { background: #f8f9fa; padding: 15px; border-radius: 4px; border-left: 4px solid #27ae60; margin-bottom: 10px; }
        .oncall-name { font-weight: 600; color: #2c3e50; margin-bottom: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>📟 OnCallShift Live Demo <span class="status-badge" id="status-badge">Loading...</span></h1>
            <p style="color: #7f8c8d; margin-top: 5px;">Real-time data from production database</p>
            <button class="refresh-btn" id="refresh-btn" onclick="loadData()">🔄 Refresh Data</button>
        </header>
        <div id="error-container"></div>
        <div class="oncall-section" id="oncall-section" style="display: none;">
            <h3>👤 Currently On-Call</h3>
            <div id="oncall-list"></div>
        </div>
        <div class="stats">
            <div class="stat-card"><div class="stat-label">🔴 Critical</div><div class="stat-value stat-critical" id="critical-count">-</div></div>
            <div class="stat-card"><div class="stat-label">⚠️ Warning</div><div class="stat-value stat-warning" id="warning-count">-</div></div>
            <div class="stat-card"><div class="stat-label">🔥 Triggered</div><div class="stat-value stat-critical" id="triggered-count">-</div></div>
            <div class="stat-card"><div class="stat-label">✅ Resolved</div><div class="stat-value stat-success" id="resolved-count">-</div></div>
        </div>
        <div class="incidents">
            <div class="incidents-header"><h2>Recent Incidents</h2><div class="last-updated" id="last-updated">Never updated</div></div>
            <div id="incidents-list" class="loading"><div class="loading-spinner"></div><div>Loading live data...</div></div>
        </div>
    </div>
    <script>
        function formatTimeAgo(dateString) {
            const date = new Date(dateString);
            const seconds = Math.floor((new Date() - date) / 1000);
            if (seconds < 60) return seconds + ' seconds ago';
            const minutes = Math.floor(seconds / 60);
            if (minutes < 60) return minutes + ' minute' + (minutes > 1 ? 's' : '') + ' ago';
            const hours = Math.floor(minutes / 60);
            if (hours < 24) return hours + ' hour' + (hours > 1 ? 's' : '') + ' ago';
            const days = Math.floor(hours / 24);
            return days + ' day' + (days > 1 ? 's' : '') + ' ago';
        }
        async function loadData() {
            const refreshBtn = document.getElementById('refresh-btn');
            refreshBtn.disabled = true;
            refreshBtn.textContent = '⏳ Loading...';
            try {
                const response = await fetch('/api/v1/demo/dashboard');
                if (!response.ok) throw new Error('HTTP ' + response.status);
                const data = await response.json();
                document.getElementById('status-badge').textContent = '🟢 Live';
                document.getElementById('status-badge').className = 'status-badge status-live';
                document.getElementById('error-container').innerHTML = '';
                document.getElementById('critical-count').textContent = data.stats.critical;
                document.getElementById('warning-count').textContent = data.stats.warning;
                document.getElementById('triggered-count').textContent = data.stats.triggered;
                document.getElementById('resolved-count').textContent = data.stats.resolved;
                if (data.oncallInfo && data.oncallInfo.length > 0) {
                    document.getElementById('oncall-section').style.display = 'block';
                    document.getElementById('oncall-list').innerHTML = data.oncallInfo.map(info =>
                        '<div class="oncall-card"><div class="oncall-name">' +
                        (info.oncallUser ? info.oncallUser.fullName : 'No one on-call') +
                        '</div><div>' + info.schedule.name + (info.isOverride ? ' (Override)' : '') + '</div></div>'
                    ).join('');
                }
                const container = document.getElementById('incidents-list');
                if (data.incidents.length === 0) {
                    container.innerHTML = '<div class="loading">No incidents found</div>';
                } else {
                    container.innerHTML = data.incidents.map(incident => {
                        const details = incident.details ? Object.entries(incident.details).map(([k, v]) => k + ': ' + v).join(', ') : 'No additional details';
                        return '<div class="incident"><div class="incident-header"><div><div class="incident-title">' + incident.summary + '</div>' +
                            '<div class="incident-number">#' + incident.number + ' • ' + incident.service.name + '</div></div>' +
                            '<div class="badges"><span class="badge badge-' + incident.severity + '">' + incident.severity + '</span>' +
                            '<span class="badge badge-' + incident.state + '">' + incident.state + '</span></div></div>' +
                            '<div class="incident-details">' + details + '</div>' +
                            '<div class="incident-meta"><span>⏰ Triggered ' + formatTimeAgo(incident.triggeredAt) + '</span>' +
                            (incident.acknowledgedBy ? '<span>✓ Ackd by ' + incident.acknowledgedBy.fullName + '</span>' : '') +
                            (incident.resolvedBy ? '<span>✓ Resolved by ' + incident.resolvedBy.fullName + '</span>' : '') +
                            (incident.eventCount > 1 ? '<span>📊 ' + incident.eventCount + ' events</span>' : '') + '</div></div>';
                    }).join('');
                }
                document.getElementById('last-updated').textContent = 'Last updated: ' + new Date().toLocaleTimeString();
            } catch (error) {
                document.getElementById('status-badge').textContent = 'Error';
                document.getElementById('status-badge').className = 'status-badge status-error';
                document.getElementById('error-container').innerHTML = '<div class="error"><strong>⚠️ Error:</strong> ' + error.message + '</div>';
                document.getElementById('incidents-list').innerHTML = '<div class="loading">Failed to load data</div>';
            } finally {
                refreshBtn.disabled = false;
                refreshBtn.textContent = '🔄 Refresh Data';
            }
        }
        loadData();
        setInterval(loadData, 30000);
    </script>
</body>
</html>`);
  });

  // Rate limiting - tiered approach based on endpoint type
  // Base rate limiter for all API routes (method-based: stricter for writes)
  app.use('/api/v1', methodBasedRateLimiter());

  // Expensive rate limiter for AI endpoints (lower limits due to cost/compute)
  app.use('/api/v1/ai-assistant', expensiveRateLimiter);
  app.use('/api/v1/ai-diagnosis', expensiveRateLimiter);
  app.use('/api/v1/ai-configuration', expensiveRateLimiter);
  app.use('/api/v1/analytics', expensiveRateLimiter);

  // Bulk rate limiter for import/export endpoints
  app.use('/api/v1/import', bulkRateLimiter);
  app.use('/api/v1/export', bulkRateLimiter);
  app.use('/api/v1/semantic-import', bulkRateLimiter);

  // API routes
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/alerts', alertRoutes);
  app.use('/api/v1/alerts', alertsCompatRoutes); // PagerDuty & OpsGenie compatible endpoints
  app.use('/api/v1/incidents', idempotencyMiddleware, incidentRoutes);
  app.use('/api/v1/schedules', idempotencyMiddleware, scheduleRoutes);
  app.use('/api/v1/escalation-policies', idempotencyMiddleware, escalationPoliciesRoutes);
  app.use('/api/v1/services', idempotencyMiddleware, serviceRoutes);
  app.use('/api/v1/devices', idempotencyMiddleware, deviceRoutes);
  app.use('/api/v1/users', idempotencyMiddleware, userRoutes);
  app.use('/api/v1/notifications', notificationRoutes);
  app.use('/api/v1/demo', demoRoutes);
  app.use('/api/v1/incidents', aiDiagnosisRoutes); // AI diagnosis routes (adds /diagnose endpoint to incidents)
  app.use('/api/v1/incidents', aiAssistantRoutes); // AI assistant routes with tool_use (adds /assistant endpoints)
  app.use('/api/v1/runbooks', idempotencyMiddleware, runbookRoutes);
  app.use('/api/v1/runbooks', runbookAutomationRoutes); // Runbook automation and execution
  app.use('/api/v1/actions', idempotencyMiddleware, actionsRoutes);
  app.use('/api/v1/setup', setupRoutes);
  app.use('/api/v1/integrations', idempotencyMiddleware, integrationsRoutes);
  app.use('/api/v1/teams', idempotencyMiddleware, teamsRoutes);
  app.use('/api/v1/routing-rules', idempotencyMiddleware, routingRulesRoutes);
  app.use('/api/v1/priorities', idempotencyMiddleware, prioritiesRoutes);
  app.use('/api/v1/business-services', idempotencyMiddleware, businessServicesRoutes);
  app.use('/api/v1/tags', idempotencyMiddleware, tagsRoutes);
  app.use('/api/v1/webhooks', webhooksRoutes);
  app.use('/api/v1/import', importRoutes);
  app.use('/api/v1/export', exportRoutes);
  app.use('/api/v1/semantic-import', idempotencyMiddleware, semanticImportRoutes);
  app.use('/api/v1/heartbeats', idempotencyMiddleware, heartbeatsRoutes);
  app.use('/api/v1/status-pages', idempotencyMiddleware, statusPagesRoutes);
  app.use('/api/v1/workflows', idempotencyMiddleware, workflowsRoutes);
  app.use('/api/v1/webhook-subscriptions', idempotencyMiddleware, webhookSubscriptionsRoutes);
  app.use('/api/v1/reports', idempotencyMiddleware, reportsRoutes);
  app.use('/api/v1/ai-worker', aiWorkerWebhooksRoutes); // Jira/GitHub webhooks - NO AUTH (moved before conferenceBridges to avoid auth middleware)
  app.use('/api/v1', conferenceBridgesRoutes);
  app.use('/api/v1/analytics', analyticsRoutes);
  app.use('/api/v1/postmortems', idempotencyMiddleware, postmortemsRoutes);
  app.use('/api/v1/cloud-credentials', idempotencyMiddleware, cloudCredentialsRoutes);
  app.use('/api/v1/ai', aiConfigurationRoutes); // AI-powered natural language configuration
  app.use('/api/v1/ai', aiRecommendationsRoutes); // AI-powered proactive recommendations
  app.use('/api/v1/api-keys', idempotencyMiddleware, apiKeysRoutes); // Organization API key management
  app.use('/api/v1/onboarding', onboardingRoutes); // AI-powered conversational onboarding
  app.use('/api/v1/ai-workers', idempotencyMiddleware, aiWorkersRoutes); // AI worker instances
  app.use('/api/v1/ai-worker-tasks', idempotencyMiddleware, aiWorkerTasksRoutes); // AI worker tasks
  app.use('/api/v1/ai-worker-approvals', idempotencyMiddleware, aiWorkerApprovalsRoutes); // AI worker approvals
  app.use('/api/v1/super-admin', superAdminRoutes); // Super admin control center

  // Serve static frontend files
  const frontendPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendPath));

  // SPA fallback - serve index.html for non-API routes
  app.get('*', (req, res, next) => {
    // Skip API routes and health checks
    if (req.path.startsWith('/api/') || req.path === '/health' || req.path === '/demo' || req.path === '/api-docs') {
      return next();
    }
    // Serve the SPA
    res.sendFile(path.join(frontendPath, 'index.html'));
  });

  // 404 handler for API routes
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      res.status(404).json({ error: 'API endpoint not found' });
    } else {
      next();
    }
  });

  // Sentry error handler (must be before other error handlers)
  if (isSentryEnabled()) {
    Sentry.setupExpressErrorHandler(app);
  }

  // Error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  });

  return app;
}
