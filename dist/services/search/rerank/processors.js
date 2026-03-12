"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RerankProcessorFactory = exports.ProfessionalRerankProcessor = exports.LimitProcessor = exports.ScoreSortProcessor = exports.ScoreFilterProcessor = exports.ScoreCalculationProcessor = void 0;
const logger_1 = require("../../../logger");
const rerank_1 = require("../../../types/rerank");
const nacos_mcp_server_1 = require("../../../types/nacos_mcp_server");
// Helper type guard for enhanced NacosMcpServer
function isEnhancedServer(server) {
    return server && typeof server === 'object' && 'name' in server && 'description' in server;
}
// Helper to ensure we have a properly typed server
function ensureEnhancedServer(server) {
    if (isEnhancedServer(server)) {
        return server;
    }
    return (0, nacos_mcp_server_1.createMcpProviderResult)(server);
}
/**
 * Calculates scores for results based on provider priority and similarity
 */
class ScoreCalculationProcessor extends rerank_1.BaseRerankProcessor {
    providerPriorities;
    constructor(providerPriorities) {
        super();
        this.providerPriorities = providerPriorities;
    }
    process(results, options) {
        const scored = results.map(server => {
            const result = ensureEnhancedServer(server);
            // If score already calculated, use it
            if ('score' in result && result.score !== undefined)
                return result;
            // Otherwise calculate based on provider priority and similarity
            const priority = this.providerPriorities[result.providerName || ''] || 0;
            const similarity = result.similarity ?? 0;
            // Simple weighted score - can be adjusted based on requirements
            const score = similarity * 0.7 + (priority / 10) * 0.3;
            return (0, nacos_mcp_server_1.createMcpProviderResult)(result, { score });
        });
        return this.next(scored, options);
    }
}
exports.ScoreCalculationProcessor = ScoreCalculationProcessor;
/**
 * Filters out results below the minimum similarity threshold
 */
class ScoreFilterProcessor extends rerank_1.BaseRerankProcessor {
    process(results, options) {
        if (options.minSimilarity === undefined) {
            return this.next(results, options);
        }
        const filtered = results.map(ensureEnhancedServer).filter(result => (result.similarity ?? 0) >= options.minSimilarity);
        if (filtered.length < results.length) {
            logger_1.logger.debug(`Filtered out ${results.length - filtered.length} results below min similarity ${options.minSimilarity}`);
        }
        return this.next(filtered, options);
    }
}
exports.ScoreFilterProcessor = ScoreFilterProcessor;
/**
 * Sorts results by score in descending order
 */
class ScoreSortProcessor extends rerank_1.BaseRerankProcessor {
    process(results) {
        const sorted = [...results].map(ensureEnhancedServer).sort((a, b) => {
            const scoreA = a.score ?? a.similarity ?? 0;
            const scoreB = b.score ?? b.similarity ?? 0;
            return scoreB - scoreA; // Descending
        });
        return this.next(sorted, {});
    }
}
exports.ScoreSortProcessor = ScoreSortProcessor;
/**
 * Limits the number of results returned
 */
class LimitProcessor extends rerank_1.BaseRerankProcessor {
    process(results, options) {
        if (options.limit === undefined || options.limit <= 0) {
            return this.next(results, options);
        }
        const limited = results.map(ensureEnhancedServer).slice(0, options.limit);
        if (limited.length < results.length) {
            logger_1.logger.debug(`Limited results from ${results.length} to ${options.limit}`);
        }
        return limited; // No next processor after limit
    }
}
exports.LimitProcessor = LimitProcessor;
/**
 * Placeholder for domain-specific professional reranking
 * Can be extended with custom business logic
 */
class ProfessionalRerankProcessor extends rerank_1.BaseRerankProcessor {
    enabled;
    constructor(enabled = false) {
        super();
        this.enabled = enabled;
    }
    process(results, options) {
        if (!this.enabled && !options.enableProfessionalRerank) {
            return this.next(results, options);
        }
        // Ensure all results are properly typed
        const enhancedResults = results.map(ensureEnhancedServer);
        // TODO: Implement domain-specific reranking logic here
        // For now, just pass through
        logger_1.logger.debug("Professional rerank executed (no-op in current implementation)");
        return this.next(enhancedResults, options);
    }
}
exports.ProfessionalRerankProcessor = ProfessionalRerankProcessor;
/**
 * Factory for creating the rerank processor chain
 */
class RerankProcessorFactory {
    static createChain(providerPriorities) {
        const scoreCalculation = new ScoreCalculationProcessor(providerPriorities);
        const scoreFilter = new ScoreFilterProcessor();
        const scoreSort = new ScoreSortProcessor();
        const limit = new LimitProcessor();
        const professionalRerank = new ProfessionalRerankProcessor(false);
        // Build the chain: calculate -> filter -> professional -> sort -> limit
        scoreCalculation
            .setNext(scoreFilter)
            .setNext(professionalRerank)
            .setNext(scoreSort)
            .setNext(limit);
        return scoreCalculation;
    }
}
exports.RerankProcessorFactory = RerankProcessorFactory;
