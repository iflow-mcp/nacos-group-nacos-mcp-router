"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpManager = void 0;
const logger_1 = require("./logger");
const router_types_1 = require("./router_types");
const md5_1 = require("./md5");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
class McpManager {
    nacosClient;
    vectorDbService;
    update_interval;
    _cache = new Map();
    mcp_server_config_version = new Map();
    healthyMcpServers = new Map(); // 存活的nacos mcp servers
    constructor(nacosClient, vectorDbService, update_interval) {
        this.nacosClient = nacosClient;
        this.vectorDbService = vectorDbService;
        this.update_interval = update_interval;
        this.updateNow();
        this.asyncUpdater();
    }
    async updateNow() {
        try {
            const mcpServers = await this.nacosClient.getMcpServers();
            logger_1.logger.debug(`get mcp server list from nacos, size: ${mcpServers.length}`);
            if (mcpServers.length === 0) {
                return;
            }
            const docs = [];
            const ids = [];
            const cache = new Map();
            for (const mcpServer of mcpServers) {
                let description = mcpServer.getDescription();
                if (mcpServer.mcpConfigDetail) {
                    description = mcpServer.mcpConfigDetail.getToolDescription();
                }
                const serverName = mcpServer.getName();
                cache.set(serverName, mcpServer);
                const md5Str = (0, md5_1.md5)(description);
                if (!this.mcp_server_config_version.has(serverName) ||
                    this.mcp_server_config_version.get(serverName) !== md5Str) {
                    this.mcp_server_config_version.set(serverName, md5Str);
                    ids.push(serverName);
                    docs.push(description);
                }
            }
            logger_1.logger.debug(`updated mcp server cache, size: ${cache.size}`);
            const mcpServerNames = Array.from(cache.keys());
            logger_1.logger.debug(`updated mcp server names: ${mcpServerNames.join(", ")}`);
            this._cache = cache;
            if (ids.length > 0) {
                await this.vectorDbService.updateData(ids, docs);
            }
        }
        catch (error) {
            logger_1.logger.warn("Failed to update MCP servers from Nacos, running in degraded mode:", error);
            // Don't throw error, just log it and continue in degraded mode
        }
    }
    async asyncUpdater() {
        let retryDelay = this.update_interval;
        while (true) {
            try {
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                await this.updateNow();
                retryDelay = this.update_interval; // 重置间隔
            }
            catch (error) {
                logger_1.logger.error("更新失败，将在", retryDelay / 1000, "秒后重试", error);
                retryDelay = Math.min(retryDelay * 2, 60000); // 最大1分钟
            }
        }
    }
    async getMcpServer(queryTexts, count) {
        try {
            const result = await this.vectorDbService.query(queryTexts, count);
            const ids = result.ids;
            const mcpServers = [];
            logger_1.logger.info(`get mcp server from vector db, ids: ${ids}`);
            for (const id of ids) {
                const mcpServer = this._cache.get(id);
                if (mcpServer !== undefined) {
                    mcpServers.push(mcpServer);
                }
            }
            return mcpServers;
        }
        catch (error) {
            logger_1.logger.error("Failed to get MCP servers:", error);
            throw error;
        }
    }
    async searchMcpByKeyword(keyword) {
        const servers = [];
        logger_1.logger.info(`cache size: ${this._cache.size}`);
        for (const mcpServer of this._cache.values()) {
            let description = mcpServer.getDescription();
            if (mcpServer.mcpConfigDetail) {
                description = mcpServer.mcpConfigDetail.getToolDescription();
            }
            if (!description) {
                continue;
            }
            if (description.includes(keyword)) {
                // TODO: 如果mcpServer.mcpConfigDetail.getToolDescription()与keyword的模糊匹配优化（description.includes(keyword)是精确匹配）
                servers.push(mcpServer);
            }
        }
        logger_1.logger.info(`result mcp servers search by keywords: ${servers.length}`);
        return servers;
    }
    async getMcpServerByName(mcpName) {
        return this._cache.get(mcpName);
    }
    async useTool(mcpServerName, toolName, params) {
        const mcpServer = this.healthyMcpServers.get(mcpServerName);
        if (!mcpServer) {
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `MCP server ${mcpServerName} not found`);
        }
        if (await mcpServer.healthy()) {
            const enrichedParams = {
                ...params,
            };
            const response = await mcpServer.executeTool(toolName, enrichedParams);
            return response.content;
        }
        else {
            this.healthyMcpServers.delete(mcpServerName);
            return "mcp server is not healthy, use search_mcp_server to get mcp servers";
        }
    }
    async addMcpServer(mcpServerName) {
        let mcpServer = await this.nacosClient.getMcpServerByName(mcpServerName);
        if (!mcpServer) {
            mcpServer = this._cache.get(mcpServerName);
        }
        if (!mcpServer || mcpServer.description === '' || !mcpServer.description) {
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `MCP server ${mcpServerName} not found`);
        }
        const disableTools = {};
        const toolMeta = mcpServer.mcpConfigDetail?.toolSpec?.toolsMeta;
        if (toolMeta) {
            for (const [toolName, meta] of Object.entries(toolMeta)) {
                if (!meta.enabled) {
                    disableTools[toolName] = true;
                }
            }
        }
        if (!this.healthyMcpServers.has(mcpServerName)) {
            const env = process.env || {};
            if (!mcpServer.agentConfig) {
                mcpServer.agentConfig = {};
            }
            if (!mcpServer.agentConfig.mcpServers || mcpServer.agentConfig.mcpServers === null) {
                mcpServer.agentConfig.mcpServers = {};
            }
            const mcpServers = mcpServer.agentConfig.mcpServers;
            for (const [key, value] of Object.entries(mcpServers)) {
                const serverConfig = value;
                if (serverConfig.env) {
                    for (const [k, v] of Object.entries(serverConfig.env)) {
                        env[k] = v;
                    }
                }
                serverConfig.env = env;
                if (!serverConfig.headers) {
                    serverConfig.headers = {};
                }
            }
            const server = new router_types_1.CustomServer(mcpServerName, mcpServer.agentConfig, mcpServer.mcpConfigDetail?.protocol || 'stdio');
            // await server.waitForInitialization();
            await server.start(mcpServerName);
            // TODO: StreamableHttpTransport 无SessionId
            if (await server.healthy()) {
                this.healthyMcpServers.set(mcpServerName, server);
            }
        }
        const server = this.healthyMcpServers.get(mcpServerName);
        if (!server) {
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to initialize MCP server ${mcpServerName}`);
        }
        const tools = await server.listTools();
        const toolList = [];
        for (const tool of tools) {
            if (disableTools[tool.name]) {
                continue;
            }
            const dct = {
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema
            };
            toolList.push(dct);
        }
        await this.nacosClient.updateMcpTools(mcpServerName, tools);
        return `1. ${mcpServerName}安装完成, tool 列表为: ${JSON.stringify(toolList, null, 2)}2. ${mcpServerName}的工具需要通过nacos-mcp-router的UseTool工具代理使用`;
    }
}
exports.McpManager = McpManager;
