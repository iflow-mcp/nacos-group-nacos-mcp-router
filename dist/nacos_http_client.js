"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NacosHttpClient = void 0;
const axios_1 = __importDefault(require("axios"));
const router_types_1 = require("./router_types");
const logger_1 = require("./logger");
const nacos_mcp_server_config_1 = require("./nacos_mcp_server_config");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
class NacosHttpClient {
    nacosAddr;
    userName;
    passwd;
    client;
    constructor(nacosAddr, userName, passwd) {
        if (!nacosAddr) {
            throw new Error('nacosAddr cannot be an empty string');
        }
        if (!userName) {
            throw new Error('userName cannot be an empty string');
        }
        if (!passwd) {
            throw new Error('passwd cannot be an empty string');
        }
        this.nacosAddr = nacosAddr;
        this.userName = userName;
        this.passwd = passwd;
        this.client = axios_1.default.create({
            baseURL: `http://${this.nacosAddr}`,
            headers: {
                'Content-Type': 'application/json',
                'charset': 'utf-8',
                'userName': this.userName,
                'password': this.passwd
            }
        });
    }
    async isReady() {
        return new Promise((resolve) => {
            this.client.get('/nacos/v3/admin/ai/mcp/list').then((response) => {
                if (response.status === 200) {
                    resolve(true);
                }
                else {
                    resolve(false);
                }
            }).catch((error) => {
                // Connection failed, return false instead of throwing
                console.error('[NacosHttpClient] Connection failed:', error.message);
                resolve(false);
            });
        });
    }
    async getMcpServerByName(name) {
        const url = `/nacos/v3/admin/ai/mcp?mcpName=${name}`;
        const mcpServer = new router_types_1.NacosMcpServer(name, '', {});
        try {
            const response = await this.client.get(url);
            if (response.status === 200) {
                const data = response.data.data;
                const config = nacos_mcp_server_config_1.NacosMcpServerConfigImpl.fromDict(data);
                const server = new router_types_1.NacosMcpServer(config.name, config.description || '', config.localServerConfig);
                server.mcpConfigDetail = config;
                if (config.protocol !== 'stdio' && config.backendEndpoints.length > 0) {
                    const endpoint = config.backendEndpoints[0];
                    const httpSchema = endpoint.port === 443 ? 'https' : 'http';
                    let url = `${httpSchema}://${endpoint.address}:${endpoint.port}${config.remoteServerConfig.exportPath}`;
                    if (!config.remoteServerConfig.exportPath.startsWith('/')) {
                        url = `${httpSchema}://${endpoint.address}:${endpoint.port}/${config.remoteServerConfig.exportPath}`;
                    }
                    if (!server.agentConfig.mcpServers) {
                        server.agentConfig.mcpServers = {};
                    }
                    server.agentConfig.mcpServers[server.name] = {
                        name: server.name,
                        description: server.description,
                        url: url
                    };
                }
                return server;
            }
        }
        catch (error) {
            logger_1.logger.warning(`failed to get mcp server ${name}, response: ${error}`);
        }
        return mcpServer;
    }
    async getMcpServers() {
        const mcpServers = [];
        try {
            const pageSize = 100;
            const pageNo = 1;
            const url = `/nacos/v3/admin/ai/mcp/list?pageNo=${pageNo}&pageSize=${pageSize}`;
            const response = await this.client.get(url);
            if (response.status !== 200) {
                logger_1.logger.warning(`failed to get mcp server list, url ${url}, response: ${response.data}`);
                return [];
            }
            for (const mcpServerDict of response.data.data.pageItems) {
                if (mcpServerDict.enabled) {
                    const mcpName = mcpServerDict.name;
                    const mcpServer = await this.getMcpServerByName(mcpName);
                    if (mcpServer.description) {
                        mcpServers.push(mcpServer);
                    }
                }
            }
        }
        catch (error) {
            logger_1.logger.error('Error getting mcp servers:', error);
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to get mcp servers: ${error}`);
        }
        return mcpServers;
    }
    async updateMcpTools(mcpName, tools) {
        try {
            const url = `/nacos/v3/admin/ai/mcp?mcpName=${mcpName}`;
            const response = await this.client.get(url);
            if (response.status === 200) {
                const data = response.data.data;
                const toolList = tools.map(tool => ({
                    name: tool.name,
                    description: tool.description,
                    inputSchema: tool.inputSchema
                }));
                const endpointSpecification = {};
                if (data.protocol !== 'stdio') {
                    endpointSpecification.data = data.remoteServerConfig.serviceRef;
                    endpointSpecification.type = 'REF';
                }
                if (!data.toolSpec) {
                    data.toolSpec = {};
                }
                data.toolSpec.tools = toolList;
                const params = {
                    mcpName: mcpName
                };
                const toolSpecification = data.toolSpec;
                delete data.toolSpec;
                delete data.backendEndpoints;
                params.serverSpecification = JSON.stringify(data);
                params.endpointSpecification = JSON.stringify(endpointSpecification);
                params.toolSpecification = JSON.stringify(toolSpecification);
                logger_1.logger.info(`update mcp tools, params ${JSON.stringify(params)}`);
                const updateResponse = await this.client.put('/nacos/v3/admin/ai/mcp', params, {
                    // Override only what differs from default headers
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                });
                if (updateResponse.status === 200) {
                    return true;
                }
                else {
                    logger_1.logger.warning(`failed to update mcp tools list, caused: ${updateResponse.data}`);
                    return false;
                }
            }
            else {
                logger_1.logger.warning(`failed to update mcp tools list, caused: ${response.data}`);
                return false;
            }
        }
        catch (error) {
            logger_1.logger.error('Error updating mcp tools:', error);
            return false;
        }
    }
}
exports.NacosHttpClient = NacosHttpClient;
