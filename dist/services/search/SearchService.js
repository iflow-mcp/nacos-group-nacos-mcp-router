"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchService = exports.COMPASS_API_BASE = void 0;
const logger_1 = require("../../logger");
const RerankMcpServer_1 = require("./rerank/RerankMcpServer");
const nacos_mcp_server_1 = require("../../types/nacos_mcp_server");
const CompassSearchProvider_1 = require("./CompassSearchProvider");
/**
 * Base URL for the COMPASS API.
 * Can be overridden by setting the COMPASS_API_BASE environment variable.
 */
exports.COMPASS_API_BASE = process.env.COMPASS_API_BASE || 'https://registry.mcphub.io';
// Helper to ensure we have a properly typed server with all required methods
function ensureEnhancedServer(server) {
    // If it's already a proper NacosMcpServer with all methods, return as is
    if (server &&
        typeof server.getName === 'function' &&
        typeof server.getDescription === 'function' &&
        typeof server.getAgentConfig === 'function' &&
        typeof server.toDict === 'function') {
        return server;
    }
    // Otherwise create a new NacosMcpServer instance with all required methods
    return (0, nacos_mcp_server_1.createMcpProviderResult)({
        ...server,
        name: server.name || '',
        description: server.description || '',
        agentConfig: server.agentConfig || {},
        mcpConfigDetail: server.mcpConfigDetail || null
    }, {
        providerName: server.providerName || 'unknown',
        similarity: server.similarity || 0,
        score: server.score || 0
    });
}
/**
 * A lightweight search service that orchestrates multiple SearchProviders
 * and provides a single `search` facade. The implementation is simplified
 * compared to the mcpadvisor version but keeps extensibility hooks (add / remove
 * provider, result dedup / basic priority ordering).
 */
class SearchService {
    providers = [];
    rerankService;
    defaultRerankOptions = {
        limit: 7,
        minSimilarity: 0.4,
        enableProfessionalRerank: false,
    };
    constructor(providers = [], providerPriorities = {}, rerankOptions, enableCompass = true) {
        this.providers = [...providers];
        if (enableCompass) {
            const compassProvider = new CompassSearchProvider_1.CompassSearchProvider(exports.COMPASS_API_BASE);
            this.providers.push(compassProvider);
        }
        this.defaultRerankOptions = { ...this.defaultRerankOptions, ...rerankOptions };
        this.rerankService = new RerankMcpServer_1.RerankMcpServer(providerPriorities, this.defaultRerankOptions);
        logger_1.logger.info(`SearchService initialized with ${this.providers.length} providers.`);
        logger_1.logger.debug(`COMPASS_API_BASE: ${exports.COMPASS_API_BASE}`);
    }
    /** Add a provider at runtime */
    addProvider(provider) {
        this.providers.push(provider);
    }
    /** Remove provider by index */
    removeProvider(index) {
        if (index >= 0 && index < this.providers.length) {
            this.providers.splice(index, 1);
        }
    }
    /** Return copy of current providers list */
    getProviders() {
        return [...this.providers];
    }
    /**
     * Update provider priorities for reranking
     */
    updateProviderPriorities(priorities) {
        this.rerankService.updateProviderPriorities(priorities);
    }
    /**
     * Update default rerank options
     */
    updateRerankOptions(options) {
        this.defaultRerankOptions = { ...this.defaultRerankOptions, ...options };
        this.rerankService.updateDefaultOptions(options);
    }
    /**
     * Invoke all providers in parallel, merge, deduplicate and rerank results.
     */
    async search(params, rerankOptions = {}) {
        if (this.providers.length === 0) {
            logger_1.logger.warn("No search providers registered, returning empty result.");
            return [];
        }
        logger_1.logger.info(`Searching with params: ${JSON.stringify(params)}`);
        const providerResults = [];
        const searchPromises = this.providers.map(async (provider) => {
            const providerName = provider.constructor.name;
            try {
                const results = await provider.search(params);
                const typedResults = results.map(result => ensureEnhancedServer({
                    ...result,
                    providerName
                }));
                providerResults.push({
                    providerName,
                    results: typedResults,
                });
            }
            catch (err) {
                logger_1.logger.error(`Provider ${providerName} failed:`, err);
                // Push empty results on error
                providerResults.push({
                    providerName,
                    results: [],
                });
            }
        });
        await Promise.all(searchPromises);
        try {
            // Merge and rerank results
            const mergedOptions = { ...this.defaultRerankOptions, ...rerankOptions };
            logger_1.logger.info(`Reranking with options: ${JSON.stringify(mergedOptions)}`);
            const rerankedResults = await this.rerankService.rerank(providerResults, mergedOptions);
            logger_1.logger.info(`Successfully reranked to ${rerankedResults.length} results`);
            return rerankedResults;
        }
        catch (error) {
            logger_1.logger.error('Error during reranking:', error);
            // Fallback to simple merge if reranking fails
            const allResults = providerResults.flatMap(pr => pr.results);
            return [...new Map(allResults.map(r => [r.getName(), r])).values()];
        }
    }
}
exports.SearchService = SearchService;
