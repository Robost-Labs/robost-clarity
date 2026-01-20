const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
    // Middleware to override Cross-Origin headers that block Google Sign-In
    app.use((req, res, next) => {
        // Remove the strict policies if they are being set by defaults
        res.removeHeader('Cross-Origin-Embedder-Policy');
        res.removeHeader('Cross-Origin-Opener-Policy');

        // Set the friendly policy that allows popups
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
        next();
    });

    // Proxy API requests to backend
    app.use(
        '/api',
        createProxyMiddleware({
            target: process.env.REACT_APP_API_URL || 'http://localhost:8004',
            changeOrigin: true,
        })
    );
};
