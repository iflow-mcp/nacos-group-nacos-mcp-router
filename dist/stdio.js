#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const router_1 = require("./router");
const logger_1 = require("./logger");
const config_1 = require("./config");
function formatReason(reason) {
    if (reason instanceof Error) {
        const name = reason.name || 'Error';
        const message = reason.message || '';
        const errorStack = reason.stack ? `\n${reason.stack}` : '';
        return `${name}: ${message}${errorStack}`;
    }
    try {
        return typeof reason === 'string' ? reason : JSON.stringify(reason);
    }
    catch {
        return String(reason);
    }
}
// Global error handlers to prevent process crashes
process.on('unhandledRejection', (reason) => {
    const msg = formatReason(reason);
    console.error('[ERROR] Unhandled Rejection:', msg);
    logger_1.logger.error(`Unhandled Rejection: ${msg}`);
    setTimeout(() => process.exit(1), 100);
});
process.on('uncaughtException', (error) => {
    const msg = formatReason(error);
    console.error('[ERROR] Uncaught Exception:', msg);
    logger_1.logger.error(`Uncaught Exception: ${msg}`);
    setTimeout(() => process.exit(1), 100);
});
async function main() {
    try {
        console.error('[DEBUG] Starting Nacos MCP Router...');
        console.error('[DEBUG] Config:', JSON.stringify(config_1.config));
        const router = new router_1.Router(config_1.config);
        console.error('[DEBUG] Router created');
        logger_1.logger.info(`nacos mcp router start`);
        console.error('[DEBUG] Starting router...');
        await router.start();
        console.error('[DEBUG] Router started successfully');
        logger_1.logger.info('Nacos MCP Router started successfully');
        console.error('[DEBUG] Waiting for stdin...');
        // Keep process alive
        process.stdin.resume();
    }
    catch (error) {
        const msg = formatReason(error);
        console.error('[ERROR] Failed to start Nacos MCP Router:', msg);
        logger_1.logger.error(`Failed to start Nacos MCP Router: ${msg}`);
        setTimeout(() => process.exit(1), 100);
    }
}
main();
