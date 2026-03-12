"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const sse_js_1 = require("@modelcontextprotocol/sdk/server/sse.js");
const router_1 = require("./router");
const config_1 = require("./config");
const logger_1 = require("./logger");
const app = (0, express_1.default)();
app.use(express_1.default.json());
// Store transports by session ID
const transports = {};
// SSE endpoint for establishing the stream
app.get('/mcp', async (req, res) => {
    try {
        // Create a new SSE transport for the client
        // The endpoint for POST messages is '/messages'
        const transport = new sse_js_1.SSEServerTransport('/messages', res);
        // Store the transport by session ID
        const sessionId = transport.sessionId;
        transports[sessionId] = transport;
        // Set up onclose handler to clean up transport when closed
        transport.onclose = () => {
            delete transports[sessionId];
        };
        const router = new router_1.Router(config_1.config);
        await router.start(transport);
    }
    catch (error) {
        console.error('Error establishing SSE stream:', error);
        if (!res.headersSent) {
            res.status(500).send('Error establishing SSE stream');
        }
    }
});
// Messages endpoint for receiving client JSON-RPC requests
app.post('/messages', async (req, res) => {
    logger_1.logger.info('Received POST request to /messages');
    // Extract session ID from URL query parameter
    // In the SSE protocol, this is added by the client based on the endpoint event
    const sessionId = req.query.sessionId;
    if (!sessionId) {
        logger_1.logger.error('No session ID provided in request URL');
        res.status(400).send('Missing sessionId parameter');
        return;
    }
    const transport = transports[sessionId];
    if (!transport) {
        logger_1.logger.error(`No active transport found for session ID: ${sessionId}`);
        res.status(404).send('Session not found');
        return;
    }
    try {
        // Handle the POST message with the transport
        await transport.handlePostMessage(req, res, req.body);
    }
    catch (error) {
        logger_1.logger.error('Error handling request:', error);
        if (!res.headersSent) {
            res.status(500).send('Error handling request');
        }
    }
});
// Start the server
const PORT = 3001;
app.listen(PORT, () => {
    logger_1.logger.info(`Simple SSE Server (deprecated protocol version 2024-11-05) listening on port ${PORT}`);
});
// Handle server shutdown
process.on('SIGINT', async () => {
    logger_1.logger.info('Shutting down server...');
    // Close all active transports to properly clean up resources
    for (const sessionId in transports) {
        try {
            logger_1.logger.info(`Closing transport for session ${sessionId}`);
            await transports[sessionId].close();
            delete transports[sessionId];
        }
        catch (error) {
            logger_1.logger.error(`Error closing transport for session ${sessionId}:`, error);
        }
    }
    logger_1.logger.info('Server shutdown complete');
    process.exit(0);
});
