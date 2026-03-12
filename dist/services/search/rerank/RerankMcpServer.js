"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RerankMcpServer = void 0;
const logger_1 = require("../../../logger");
const processors_1 = require("./processors");
const nacos_mcp_server_1 = require("../../../types/nacos_mcp_server");
/**
 * Service for re-ranking MCP server search results from multiple providers
 */
class RerankMcpServer {
    providerPriorities;
    processor;
    defaultOptions;
    constructor(providerPriorities = {}, defaultOptions = {}) {
        this.providerPriorities = providerPriorities;
        this.defaultOptions = {
            limit: 7,
            minSimilarity: 0,
            enableProfessionalRerank: false,
            ...defaultOptions
        };
        // Create the processor chain
        this.processor = processors_1.RerankProcessorFactory.createChain(providerPriorities);
    }
    /**
     * Merge and rerank results from multiple providers
     */
    async rerank(providerResults, options = {}) {
        const mergedOptions = { ...this.defaultOptions, ...options };
        // Flatten and deduplicate results by name before processing
        const { merged, duplicates } = this.mergeAndDeduplicate(providerResults);
        logger_1.logger.debug(`Reranking ${merged.length} unique results from ${providerResults.length} providers`);
        if (duplicates > 0) {
            logger_1.logger.debug(`Merged ${duplicates} duplicate results from multiple providers`);
        }
        // Process through the chain
        return this.processor.process(merged, mergedOptions);
    }
    /**
     * Merge results from multiple providers, keeping track of duplicates
     */
    mergeAndDeduplicate(providerResults) {
        const seen = new Map();
        let duplicates = 0;
        // Process each provider's results
        for (const { providerName, results } of providerResults) {
            for (const baseResult of results) {
                try {
                    // Skip invalid base results
                    if (!baseResult || typeof baseResult !== 'object') {
                        logger_1.logger.warn('Skipping invalid search result: not an object');
                        continue;
                    }
                    // Ensure we have required properties with defaults
                    const baseProps = {
                        name: baseResult.name || '',
                        description: baseResult.description || '',
                        agentConfig: baseResult.agentConfig || {},
                        mcpConfigDetail: baseResult.mcpConfigDetail || null,
                        // Include any additional properties from the base result
                        ...Object.fromEntries(Object.entries(baseResult).filter(([key]) => !['name', 'description', 'agentConfig', 'mcpConfigDetail'].includes(key)))
                    };
                    // Create a properly typed NacosMcpServer with all required methods
                    const result = (0, nacos_mcp_server_1.createMcpProviderResult)(baseProps, {
                        providerName,
                        similarity: 'similarity' in baseResult ? Number(baseResult.similarity) : undefined,
                        score: 'score' in baseResult ? Number(baseResult.score) : undefined
                    });
                    const key = result.getName().toLowerCase();
                    if (seen.has(key)) {
                        // For duplicates, keep the one with higher score
                        const existing = seen.get(key);
                        const existingScore = existing.score ?? existing.similarity ?? 0;
                        const newScore = result.score ?? result.similarity ?? 0;
                        if (newScore > existingScore) {
                            seen.set(key, result);
                        }
                        duplicates++;
                    }
                    else {
                        seen.set(key, result);
                    }
                }
                catch (error) {
                    logger_1.logger.error('Error processing search result:', error);
                    continue;
                }
            }
        }
        // Convert the map values to an array and ensure all items are valid NacosMcpServers
        const mergedResults = [];
        for (const server of seen.values()) {
            if ((0, nacos_mcp_server_1.isNacosMcpServer)(server)) {
                mergedResults.push(server);
            }
            else {
                logger_1.logger.warn('Skipping invalid server result - missing required methods');
            }
        }
        return {
            merged: mergedResults,
            duplicates
        };
    }
    /**
     * Update provider priorities
     */
    updateProviderPriorities(priorities) {
        this.providerPriorities = { ...this.providerPriorities, ...priorities };
        // Recreate processor chain with new priorities
        this.processor = processors_1.RerankProcessorFactory.createChain(this.providerPriorities);
    }
    /**
     * Update default rerank options
     */
    updateDefaultOptions(options) {
        this.defaultOptions = { ...this.defaultOptions, ...options };
    }
}
exports.RerankMcpServer = RerankMcpServer;
