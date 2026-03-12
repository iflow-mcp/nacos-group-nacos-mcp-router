"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Router = void 0;
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const nacos_http_client_1 = require("./nacos_http_client");
const mcp_manager_1 = require("./mcp_manager");
const logger_1 = require("./logger");
const zod_1 = require("zod");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const router_types_1 = require("./router_types");
const NacosMcpProvider_1 = require("./services/search/NacosMcpProvider");
const SearchService_1 = require("./services/search/SearchService");
const CompassSearchProvider_1 = require("./services/search/CompassSearchProvider");
const MCP_SERVER_NAME = "nacos-mcp-router";
class Router {
    nacosClient;
    mcpManager;
    vectorDB;
    searchService;
    mcpServer;
    constructor(config) {
        const { serverAddr, username, password } = config.nacos;
        this.nacosClient = new nacos_http_client_1.NacosHttpClient(serverAddr, username, password);
    }
    async registerMcpTools() {
        if (!this.mcpServer) {
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, "MCP server not initialized");
        }
        try {
            this.mcpServer.tool("SearchMcpServer", `根据任务描述及关键字搜索mcp server，制定完成任务的步骤;Args:task_description: 用户任务描述，使用中文;key_words: 字符串数组，用户任务关键字，使用中文,可以为多个，最多为2个`, { taskDescription: zod_1.z.string(), keyWords: zod_1.z.string().array().nonempty({
                    message: "Can't be empty!",
                }).max(2) }, async ({ taskDescription, keyWords }) => {
                try {
                    const mcpServers1 = await this.searchMcpServer(taskDescription, keyWords);
                    // 构建结果
                    const result = {};
                    for (const mcpServer of mcpServers1) {
                        result[mcpServer.getName()] = {
                            name: mcpServer.getName(),
                            description: mcpServer.getDescription()
                        };
                    }
                    const content = JSON.stringify(result, null, 2);
                    const jsonString = `## 获取${taskDescription}的步骤如下：
### 1. 当前可用的mcp server列表为：
${content}
### 2. 从当前可用的mcp server列表中选择你需要的mcp server调AddMcpServer工具安装mcp server`;
                    return {
                        content: [{
                                type: "text",
                                text: jsonString
                            }]
                    };
                }
                catch (error) {
                    logger_1.logger.warn(`failed to search_mcp_server: ${taskDescription}`, error);
                    return {
                        content: [{
                                type: "text",
                                text: `failed to search mcp server for ${taskDescription}`
                            }]
                    };
                }
            });
            this.mcpServer.tool("UseTool", '使用指定MCP服务器上的工具。需要先通过AddMcpServer安装MCP服务器，然后才能使用其工具。', { mcpServerName: zod_1.z.string(), toolName: zod_1.z.string(), params: zod_1.z.record(zod_1.z.string(), zod_1.z.any()) }, async ({ mcpServerName, toolName, params }) => {
                try {
                    const result = await this.mcpManager.useTool(mcpServerName, toolName, params);
                    return {
                        content: [{
                                type: "text",
                                text: JSON.stringify(result)
                            }]
                    };
                }
                catch (error) {
                    logger_1.logger.error(`Failed to use tool ${toolName} from server ${mcpServerName}:`, error);
                    // throw new McpError(ErrorCode.InternalError, `Failed to use tool ${toolName} from server ${mcpServerName}`);
                    return {
                        content: [{
                                type: "text",
                                text: `Failed to use tool ${toolName} from server ${mcpServerName}`
                            }]
                    };
                }
            });
            this.mcpServer.tool("AddMcpServer", `安装指定的mcp server, return mcp server安装结果`, { mcpServerName: zod_1.z.string() }, async ({ mcpServerName }) => {
                try {
                    const result = await this.mcpManager.addMcpServer(mcpServerName);
                    return {
                        content: [{
                                type: "text",
                                text: JSON.stringify(result)
                            }]
                    };
                }
                catch (error) {
                    logger_1.logger.error(`Failed to add mcp server ${mcpServerName}:`, error);
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to add mcp server ${mcpServerName}`);
                }
            });
        }
        catch (error) {
            logger_1.logger.error("Failed to register MCP tools:", error);
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, "Failed to register MCP tools:", error);
        }
    }
    /**
     * Search for MCP servers using the configured search service
     * @param taskDescription Description of the task to search for
     * @param keyWords Additional keywords to refine the search
     * @returns Array of matching NacosMcpServer instances
     */
    async searchMcpServer(taskDescription, keyWords) {
        if (!this.searchService) {
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, "Search service not initialized");
        }
        try {
            const params = {
                taskDescription,
                keywords: keyWords,
                // Include any additional search parameters as needed
            };
            // Use the search service to get results from all providers
            const results = await this.searchService.search(params);
            // Ensure we return results in the expected format with proper method bindings
            return results.map(server => {
                // Create a new object with all properties from the server
                const result = { ...server };
                // Add methods with proper 'this' binding
                result.getName = function () { return this.name; };
                result.getDescription = function () { return this.description || ''; };
                result.getAgentConfig = function () { return this.agentConfig || {}; };
                result.toDict = function () {
                    return {
                        name: this.name,
                        description: this.description || '',
                        mcpConfigDetail: this.mcpConfigDetail,
                        agentConfig: this.agentConfig || {}
                    };
                };
                return result;
            });
        }
        catch (error) {
            logger_1.logger.error('Error in searchMcpServer:', error);
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Search failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async start(replaceTransport) {
        try {
            // const modelName = "all-MiniLM-L6-v2";
            // const defaultEF = new DefaultEmbeddingFunction({ model: modelName });
            // console.log(`defaultEF: ${defaultEF}`);
            const { env } = await import('@xenova/transformers');
            const mirrorHost = process.env.HF_MIRROR_HOST || 'https://hf-mirror.com';
            env.remoteHost = mirrorHost;
            if (!this.vectorDB) {
                this.vectorDB = new router_types_1.VectorDB();
                await this.vectorDB.start();
                await this.vectorDB.isReady();
                logger_1.logger.info(`vectorDB is ready, collectionId: ${this.vectorDB._collectionId}`);
            }
            let isReady = false;
            try {
                isReady = await this.nacosClient.isReady();
            }
            catch (error) {
                console.error('[WARN] Nacos connection failed:', error);
                logger_1.logger.warn(`Nacos connection failed: ${error}`);
            }
            if (!isReady) {
                logger_1.logger.warn(`Nacos client is not ready or not connected, running in degraded mode. Please check the nacos server config.`);
                console.error('[WARN] Nacos client not ready, running in degraded mode');
            }
            else {
                logger_1.logger.info(`nacosClient is ready: ${isReady}`);
            }
            if (!this.mcpManager) {
                // 初始化核心服务
                this.mcpManager = new mcp_manager_1.McpManager(this.nacosClient, this.vectorDB, 5000);
                // Initialize search service with providers
                const nacosProvider = new NacosMcpProvider_1.NacosMcpProvider(this.mcpManager);
                const compassProvider = new CompassSearchProvider_1.CompassSearchProvider(SearchService_1.COMPASS_API_BASE);
                this.searchService = new SearchService_1.SearchService([nacosProvider, compassProvider]);
            }
            if (!this.mcpServer) {
                this.mcpServer = new mcp_js_1.McpServer({
                    name: MCP_SERVER_NAME,
                    version: "1.0.0",
                });
            }
            logger_1.logger.info(`registerMcpTools`);
            this.registerMcpTools();
            console.error('[DEBUG] About to connect to transport...');
            if (replaceTransport) {
                console.error('[DEBUG] Using replace transport');
                this.mcpServer.connect(replaceTransport);
            }
            else {
                console.error('[DEBUG] Creating stdio transport...');
                const transport = new stdio_js_1.StdioServerTransport();
                logger_1.logger.info(`transport: ${transport}`);
                console.error('[DEBUG] Transport created, connecting...');
                await this.mcpServer.connect(transport);
                console.error('[DEBUG] Connected successfully');
                logger_1.logger.info(`mcpServer is connected, transport: ${JSON.stringify(transport)}`);
            }
        }
        catch (error) {
            console.error('[ERROR] Error in start method:', error);
            logger_1.logger.error("Failed to start Nacos MCP Router:", error);
            // throw error;
        }
    }
}
exports.Router = Router;
