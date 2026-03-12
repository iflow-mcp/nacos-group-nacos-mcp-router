"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectorDB = exports.NacosMcpServer = exports.CustomServer = void 0;
const sse_js_1 = require("@modelcontextprotocol/sdk/client/sse.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/client/stdio.js");
const index_js_1 = require("@modelcontextprotocol/sdk/client/index.js");
const logger_1 = require("./logger");
const memory_vector_1 = require("./memory_vector");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const streamableHttp_js_1 = require("@modelcontextprotocol/sdk/client/streamableHttp.js");
function _stdioTransportContext(config) {
    logger_1.logger.info(`stdio transport context, config: ${JSON.stringify(config)}`);
    return new stdio_js_1.StdioClientTransport({
        command: config.command,
        args: config.args,
        env: config.env
    });
}
function _sseTransportContext(config) {
    return new sse_js_1.SSEClientTransport(new URL(config.url), {
    // headers: config.headers,
    // timeout: 10
    });
}
function _streamableHttpTransportContext(config) {
    return new streamableHttp_js_1.StreamableHTTPClientTransport(new URL(config.url), {
        sessionId: config.sessionId
    });
}
class CustomServer {
    name;
    config;
    _transportContextFactory;
    client;
    sessionId;
    protocol;
    selectedServerKey;
    constructor(name, config, protocol) {
        this.name = name;
        this.config = config;
        this.protocol = protocol;
        logger_1.logger.info(`mcp server config: ${JSON.stringify(config)}, protocol: ${protocol}`);
        this._transportContextFactory = _stdioTransportContext;
        if (protocol === 'mcp-sse') {
            this._transportContextFactory = _sseTransportContext;
        }
        else if (protocol === 'mcp-streamble') {
            this._transportContextFactory = _streamableHttpTransportContext;
        }
        // 全局保持一个client 切换连接？
        // this.client = new Client({
        //   name: this.name,
        //   version: '1.0.0'
        // })
    }
    /**
     * 解析服务器键，处理别名和错误情况
     * @param key 要解析的键名
     * @param context 上下文信息，用于日志记录
     * @returns 解析后的服务器键
     */
    resolveServerKey(key, context = 'server') {
        const serverKeys = this.config?.mcpServers ? Object.keys(this.config.mcpServers) : [];
        let resolvedKey = key;
        if (!serverKeys.includes(resolvedKey)) {
            if (serverKeys.length === 1) {
                resolvedKey = serverKeys[0];
                logger_1.logger.warn(`${context} 使用的 key '${key}' 不在 mcpServers 中，自动使用唯一 key '${resolvedKey}'`);
            }
            else {
                logger_1.logger.error(`${context} 使用的 key '${key}' 不在 mcpServers 中，可用 keys: ${JSON.stringify(serverKeys)}`);
                throw new Error(`${context} failed: server key '${key}' not found in agentConfig.mcpServers`);
            }
        }
        return resolvedKey;
    }
    async start(mcpServerName) {
        let notificationCount = 0;
        // Create a new client
        this.client = new index_js_1.Client({
            name: this.name,
            version: '1.0.0'
        });
        this.client.onerror = (error) => {
            logger_1.logger.error('\x1b[31mClient error:', error, '\x1b[0m');
        };
        // Set up notification handlers
        this.client.setNotificationHandler(types_js_1.LoggingMessageNotificationSchema, (notification) => {
            notificationCount++;
            logger_1.logger.info(`Notification #${notificationCount}: ${notification.params.level} - ${notification.params.data}`);
            // Re-display the prompt
            // process.stdout.write('> ');
        });
        this.client.setNotificationHandler(types_js_1.ResourceListChangedNotificationSchema, async (_) => {
            logger_1.logger.info(`Resource list changed notification received!`);
            try {
                if (!this.client) {
                    logger_1.logger.error('Client disconnected, cannot fetch resources');
                    return;
                }
                const resourcesResult = await this.client.request({
                    method: 'resources/list',
                    params: {}
                }, types_js_1.ListResourcesResultSchema);
                logger_1.logger.info('Available resources count:', resourcesResult.resources.length);
            }
            catch {
                logger_1.logger.error('Failed to list resources after change notification');
            }
        });
        // 解析实际的 server key（避免传入别名导致取值为 undefined）
        this.selectedServerKey = this.resolveServerKey(mcpServerName, 'mcpServerName');
        // Connect the client
        let transport;
        if (this.protocol === 'mcp-streamble') {
            transport = this._transportContextFactory({
                ...this.config.mcpServers[this.selectedServerKey],
                sessionId: this.sessionId // StreamableHttpTransport 需要Client保存sessionId
            });
        }
        else {
            logger_1.logger.info(`stdio transport context, config: ${JSON.stringify(this.config)}`);
            transport = this._transportContextFactory(this.config.mcpServers[this.selectedServerKey]);
        }
        await this.client.connect(transport);
        // TODO: StreamableHttpTransport 未返回SessionId，没有赋值成功 看看transport由哪里初始化
        if (transport instanceof streamableHttp_js_1.StreamableHTTPClientTransport) {
            this.sessionId = transport.sessionId;
        }
    }
    async healthy() {
        try {
            logger_1.logger.info(`check health, client: ${this.client}`);
            // 检查客户端是否已初始化  
            if (!this.client) {
                return false;
            }
            const result = await this.client?.ping();
            logger_1.logger.info(`check health, result: ${JSON.stringify(result)}`);
            return true;
            // 检查 transport 是否存在  
            // const transport = this.client.transport;
            // if (!transport) {
            //   return false;
            // }
            // logger.info(`check health, transport: ${JSON.stringify(transport)}`);
            // // 检查 transport 类型并进行相应的健康检查  
            // if (transport instanceof StdioClientTransport) {
            //   // 对于 Stdio transport，检查进程是否仍在运行  
            //   return transport['_process']?.killed === false;
            // } else if (transport instanceof StreamableHTTPClientTransport) {
            //   // 对于 StreamableHTTPClientTransport，检查 sessionId 是否存在  
            //   return transport.sessionId !== undefined;
            // } else if (transport instanceof SSEClientTransport) {
            //   // 对于其他类型的 transport，使用通用检查  
            //   const isHealthy = !!transport['_endpoint']?.searchParams.get('sessionId');
            //   logger.info(`transport: ${transport['_endpoint']?.searchParams.get('sessionId')}, isHealthy: ${isHealthy}`);
            //   return isHealthy;
            // }
            // return false;
        }
        catch (e) {
            logger_1.logger.error(`Error checking health for server ${this.name}:`, e);
            return false;
        }
    }
    // async requestForShutdown(): Promise<void> {
    //   // this._shutdownEvent = Promise.resolve();
    //   await this.client.close();
    // }
    async listTools() {
        if (!this.client || !(await this.healthy())) {
            throw new Error(`Server ${this.name} is not initialized`);
        }
        try {
            // Use the client.listTools() method which is a convenience wrapper  
            // around client.request() for the tools/list endpoint  
            const toolsResult = await this.client.listTools();
            return toolsResult.tools;
        }
        catch (e) {
            logger_1.logger.error(`Failed to list tools for server ${this.name}:`, e);
            throw e;
        }
    }
    async executeTool(toolName, params, retries = 2, delay = 1.0) {
        if (!this.client || !(await this.healthy())) {
            throw new Error(`Server ${this.name} not initialized`);
        }
        const executeWithRetry = async (attempt) => {
            try {
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), 10000));
                const result = await Promise.race([timeoutPromise, this.client.request({
                        method: 'tools/call',
                        params: {
                            name: toolName,
                            arguments: params
                        }
                    }, types_js_1.CallToolResultSchema)]);
                return result;
            }
            catch (e) {
                if (attempt >= retries) {
                    throw e;
                }
                logger_1.logger.warn(`Tool execution failed for ${toolName} on server ${this.name}, attempt ${attempt}/${retries}`, e);
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, delay * 1000));
                // Try to reconnect if needed
                if (!(await this.healthy())) {
                    logger_1.logger.info(`Reconnecting to server ${this.name} before retry`);
                    const key = this.selectedServerKey || this.name;
                    const resolvedKey = this.resolveServerKey(key, 'reconnect');
                    const transport = this._transportContextFactory(this.config.mcpServers[resolvedKey]);
                    await this.client.connect(transport);
                }
                // Recursive retry
                return executeWithRetry(attempt + 1);
            }
        };
        return executeWithRetry(1);
    }
}
exports.CustomServer = CustomServer;
class NacosMcpServer {
    name;
    description;
    mcpConfigDetail;
    agentConfig;
    constructor(name, description, agentConfig) {
        this.name = name;
        this.description = description;
        this.agentConfig = agentConfig;
        this.mcpConfigDetail = null;
    }
    getName() {
        return this.name;
    }
    getDescription() {
        return this.description;
    }
    getAgentConfig() {
        return this.agentConfig;
    }
    toDict() {
        return {
            name: this.name,
            description: this.description,
            agentConfig: this.getAgentConfig()
        };
    }
}
exports.NacosMcpServer = NacosMcpServer;
// MemoryVectorDb 兼容接口实现
class VectorDB {
    db;
    _collectionId;
    constructor() {
        this._collectionId = `nacos_mcp_router-collection-${process.pid}`;
        this.db = new memory_vector_1.MemoryVectorDB({ numDimensions: 384, clearOnStart: true });
    }
    async start() {
        // MemoryVectorDB 初始化已在构造函数完成
        // 可根据需要预加载或其他操作
        return;
    }
    async isReady() {
        // MemoryVectorDB 无需等待服务启动，直接返回 true
        return true;
    }
    async getCollectionCount() {
        return this.db.getCount();
    }
    updateData(ids, documents, metadatas) {
        if (!documents)
            return;
        documents.forEach((doc, i) => {
            this.db.add(doc, { id: ids[i], ...(metadatas ? metadatas[i] : {}) });
        });
        this.db.save();
    }
    async query(query, count) {
        const results = await this.db.search(query, count);
        return {
            ids: [results.map(r => r.metadata.id)],
            documents: [results.map(r => r.metadata.text)],
            metadatas: [results.map(r => r.metadata)],
            distances: [results.map(r => r.distance)],
            included: []
        };
    }
    async get(ids) {
        // 简单实现：根据 id 查找元数据
        const all = this.db['metadatas'] || [];
        const found = all.filter((m) => ids.includes(m.id));
        return {
            ids,
            documents: found.map((m) => m.text),
            metadatas: found,
            included: []
        };
    }
}
exports.VectorDB = VectorDB;
