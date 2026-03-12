"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NacosMcpServerConfigImpl = exports.BackendEndpointImpl = exports.RemoteServerConfigImpl = exports.ServiceRefImpl = exports.ToolSpecImpl = exports.ToolMetaImpl = exports.ToolImpl = exports.InputSchemaImpl = exports.InputPropertyImpl = void 0;
const logger_1 = require("./logger");
class InputPropertyImpl {
    type;
    description;
    constructor(type, description) {
        this.type = type;
        this.description = description;
    }
    static fromDict(data) {
        if (!data || Object.keys(data).length === 0) {
            return new InputPropertyImpl('', '');
        }
        return new InputPropertyImpl(data.type, data.description);
    }
}
exports.InputPropertyImpl = InputPropertyImpl;
class InputSchemaImpl {
    type;
    properties;
    constructor(type, properties) {
        this.type = type;
        this.properties = properties;
    }
    static fromDict(data) {
        if (!data || Object.keys(data).length === 0) {
            return new InputSchemaImpl('', {});
        }
        const properties = {};
        for (const [key, value] of Object.entries(data.properties)) {
            properties[key] = InputPropertyImpl.fromDict(value);
        }
        return new InputSchemaImpl(data.type, properties);
    }
}
exports.InputSchemaImpl = InputSchemaImpl;
class ToolImpl {
    name;
    description;
    inputSchema;
    constructor(name, description, inputSchema) {
        this.name = name;
        this.description = description;
        this.inputSchema = inputSchema;
    }
    static fromDict(data) {
        return new ToolImpl(data.name, data.description, InputSchemaImpl.fromDict(data.inputSchema));
    }
}
exports.ToolImpl = ToolImpl;
class ToolMetaImpl {
    invokeContext;
    enabled;
    templates;
    constructor(invokeContext, enabled, templates) {
        this.invokeContext = invokeContext;
        this.enabled = enabled;
        this.templates = templates;
    }
    static fromDict(data) {
        return new ToolMetaImpl(data.invokeContext || {}, data.enabled ?? true, data.templates || {});
    }
}
exports.ToolMetaImpl = ToolMetaImpl;
class ToolSpecImpl {
    tools;
    toolsMeta;
    constructor(tools, toolsMeta) {
        this.tools = tools;
        this.toolsMeta = toolsMeta;
    }
    static fromDict(data) {
        return new ToolSpecImpl((data.tools || []).map((t) => ToolImpl.fromDict(t)), Object.fromEntries(Object.entries(data.toolsMeta || {}).map(([k, v]) => [k, ToolMetaImpl.fromDict(v)])));
    }
}
exports.ToolSpecImpl = ToolSpecImpl;
class ServiceRefImpl {
    namespaceId;
    groupName;
    serviceName;
    constructor(namespaceId, groupName, serviceName) {
        this.namespaceId = namespaceId;
        this.groupName = groupName;
        this.serviceName = serviceName;
    }
    static fromDict(data) {
        if (!data || Object.keys(data).length === 0) {
            return new ServiceRefImpl('', '', '');
        }
        return new ServiceRefImpl(data.namespaceId, data.groupName, data.serviceName);
    }
}
exports.ServiceRefImpl = ServiceRefImpl;
class RemoteServerConfigImpl {
    serviceRef;
    exportPath;
    credentials;
    constructor(serviceRef, exportPath, credentials) {
        this.serviceRef = serviceRef;
        this.exportPath = exportPath;
        this.credentials = credentials;
    }
    static fromDict(data) {
        if (!data || Object.keys(data).length === 0) {
            return new RemoteServerConfigImpl(ServiceRefImpl.fromDict({}), '', {});
        }
        return new RemoteServerConfigImpl(ServiceRefImpl.fromDict(data.serviceRef), data.exportPath, data.credentials || {});
    }
}
exports.RemoteServerConfigImpl = RemoteServerConfigImpl;
class BackendEndpointImpl {
    address;
    port;
    constructor(address, port) {
        this.address = address;
        this.port = port;
    }
    static fromDict(data) {
        if (!data || Object.keys(data).length === 0) {
            return new BackendEndpointImpl('', -1);
        }
        return new BackendEndpointImpl(data.address, data.port);
    }
}
exports.BackendEndpointImpl = BackendEndpointImpl;
class NacosMcpServerConfigImpl {
    name;
    protocol;
    description;
    version;
    remoteServerConfig;
    localServerConfig;
    enabled;
    capabilities;
    backendEndpoints;
    toolSpec;
    constructor(name, protocol, description, version, remoteServerConfig, localServerConfig, enabled, capabilities, backendEndpoints, toolSpec) {
        this.name = name;
        this.protocol = protocol;
        this.description = description;
        this.version = version;
        this.remoteServerConfig = remoteServerConfig;
        this.localServerConfig = localServerConfig;
        this.enabled = enabled;
        this.capabilities = capabilities;
        this.backendEndpoints = backendEndpoints;
        this.toolSpec = toolSpec;
    }
    static fromDict(data) {
        const toolSpecData = data.toolSpec;
        const backendEndpointsData = data.backendEndpoints;
        try {
            return new NacosMcpServerConfigImpl(data.name, data.protocol, data.description, data.version, RemoteServerConfigImpl.fromDict(data.remoteServerConfig), data.localServerConfig || {}, data.enabled ?? true, data.capabilities || [], backendEndpointsData ? backendEndpointsData.map((e) => BackendEndpointImpl.fromDict(e)) : [], toolSpecData ? ToolSpecImpl.fromDict(toolSpecData) : new ToolSpecImpl([], {}));
        }
        catch (error) {
            logger_1.logger.warn(`failed to parse NacosMcpServerConfig from data: ${JSON.stringify(data)}`, error);
            throw new Error('failed to parse NacosMcpServerConfig from data');
        }
    }
    static fromString(string) {
        return NacosMcpServerConfigImpl.fromDict(JSON.parse(string));
    }
    getToolDescription() {
        let des = this.description || '';
        for (const tool of this.toolSpec.tools) {
            if (tool.description) {
                des += '\n' + tool.description;
            }
        }
        return des;
    }
}
exports.NacosMcpServerConfigImpl = NacosMcpServerConfigImpl;
