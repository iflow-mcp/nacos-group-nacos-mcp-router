"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
require("dotenv/config");
exports.config = {
    nacos: {
        serverAddr: process.env.NACOS_SERVER_ADDR || 'localhost:8848',
        username: process.env.NACOS_USERNAME || "nacos",
        password: process.env.NACOS_PASSWORD || "nacos_password",
    },
};
