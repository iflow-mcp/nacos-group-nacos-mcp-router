"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.NacosMcpRouteLogger = void 0;
const winston_1 = __importDefault(require("winston")); // 日志滚动
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
require("winston-daily-rotate-file");
const fs_1 = __importDefault(require("fs"));
class NacosMcpRouteLogger {
    static logger = null;
    static setupLogger() {
        const logDir = path_1.default.join(os_1.default.homedir(), 'logs', 'nacos_mcp_router');
        const logFile = path_1.default.join(logDir, 'router.log');
        try {
            // 确保日志目录存在
            if (fs_1.default.existsSync(logDir)) {
                fs_1.default.mkdirSync(logDir, { recursive: true });
            }
        }
        catch (err) {
            // logger.error(`Failed to create log directory: ${logDir}`, err);
            // throw err;
        }
        const formatter = winston_1.default.format.combine(winston_1.default.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }), winston_1.default.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} | nacos_mcp_router | ${level.padEnd(8)} | ${message}`;
        }));
        NacosMcpRouteLogger.logger = winston_1.default.createLogger({
            level: 'info',
            format: formatter,
            transports: [
                new winston_1.default.transports.DailyRotateFile({
                    filename: logFile,
                    datePattern: 'YYYY-MM-DD',
                    maxSize: '10m', // 10MB
                    maxFiles: '5', // 保留5个备份文件
                    zippedArchive: true,
                    format: formatter
                })
            ]
        });
    }
    static getLogger() {
        if (!NacosMcpRouteLogger.logger) {
            NacosMcpRouteLogger.setupLogger();
        }
        return NacosMcpRouteLogger.logger || winston_1.default.createLogger();
    }
    static info(message, ...args) {
        NacosMcpRouteLogger.getLogger().info(message, ...args);
    }
    static error(message, ...args) {
        NacosMcpRouteLogger.getLogger().error(message, ...args);
    }
    static warn(message, ...args) {
        NacosMcpRouteLogger.getLogger().warn(message, ...args);
    }
    static debug(message, ...args) {
        NacosMcpRouteLogger.getLogger().debug(message, ...args);
    }
}
exports.NacosMcpRouteLogger = NacosMcpRouteLogger;
// 导出单例实例
exports.logger = NacosMcpRouteLogger.getLogger();
