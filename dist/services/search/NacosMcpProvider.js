"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NacosMcpProvider = void 0;
/**
 * Default implementation backed by the existing {@link McpManager} logic that
 * queries Nacos and the in-memory vector DB.
 */
class NacosMcpProvider {
    mcpManager;
    constructor(mcpManager) {
        this.mcpManager = mcpManager;
    }
    async search(params) {
        const { taskDescription, keywords = [] } = params;
        const candidates = [];
        // 1. Keyword search (exact / fuzzy match in cache)
        for (const keyword of keywords) {
            const byKeyword = await this.mcpManager.searchMcpByKeyword(keyword);
            if (byKeyword.length > 0) {
                candidates.push(...byKeyword);
            }
        }
        // 2. Vector DB semantic search if results are fewer than 5
        if (candidates.length < 5) {
            const additional = await this.mcpManager.getMcpServer(taskDescription, 5 - candidates.length);
            candidates.push(...additional);
        }
        // TODO: 去重 / rerank – 留待后续的结果处理组件实现
        return candidates;
    }
}
exports.NacosMcpProvider = NacosMcpProvider;
