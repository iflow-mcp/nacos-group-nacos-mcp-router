"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isNacosMcpServer = isNacosMcpServer;
exports.createMcpProviderResult = createMcpProviderResult;
const router_types_1 = require("../router_types");
/**
 * Type guard to check if an object is a NacosMcpServer
 */
function isNacosMcpServer(obj) {
    return (obj &&
        typeof obj === 'object' &&
        'name' in obj &&
        'description' in obj &&
        'agentConfig' in obj &&
        typeof obj.getName === 'function' &&
        typeof obj.getDescription === 'function' &&
        typeof obj.getAgentConfig === 'function' &&
        typeof obj.toDict === 'function');
}
/**
 * Creates a new NacosMcpServer with additional search/rerank properties
 * Ensures all required methods are properly bound to the returned object
 */
function createMcpProviderResult(base, options = {}) {
    // Create a new instance of NacosMcpServer with required properties
    const server = new router_types_1.NacosMcpServer(base.name, base.description || '', base.agentConfig || {});
    // Add mcpConfigDetail if provided
    if (base.mcpConfigDetail !== undefined) {
        server.mcpConfigDetail = base.mcpConfigDetail;
    }
    // Add search/rerank specific properties
    if (options.providerName) {
        server.providerName = options.providerName;
    }
    // NacosMcpProvider is the default provider, so it should have the highest priority
    if (options.providerName === 'NacosMcpProvider') {
        server.similarity = 1;
        server.score = 1;
    }
    else {
        if (options.similarity !== undefined) {
            server.similarity = options.similarity;
        }
        if (options.score !== undefined) {
            server.score = options.score;
        }
    }
    // Copy any additional properties from base
    const extraProps = Object.entries(base).reduce((acc, [key, value]) => {
        if (!['name', 'description', 'agentConfig', 'mcpConfigDetail'].includes(key)) {
            acc[key] = value;
        }
        return acc;
    }, {});
    Object.assign(server, extraProps);
    return server;
}
