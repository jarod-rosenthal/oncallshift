// CloudFront Function for SPA routing
// Rewrites requests to /index.html for client-side routing
// Excludes: /api/* paths, /health, /api-docs*, and files with extensions

function handler(event) {
    var request = event.request;
    var uri = request.uri;

    // Don't rewrite API requests - let them pass through to ALB
    if (uri.startsWith('/api/') || uri === '/health' || uri.startsWith('/api-docs')) {
        return request;
    }

    // Don't rewrite requests for files with extensions (e.g., .js, .css, .png)
    if (uri.includes('.')) {
        return request;
    }

    // Don't rewrite if it's the root
    if (uri === '/') {
        request.uri = '/index.html';
        return request;
    }

    // Rewrite all other requests to /index.html for SPA routing
    request.uri = '/index.html';
    return request;
}
