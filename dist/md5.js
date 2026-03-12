"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.md5 = md5;
const crypto_1 = require("crypto");
function md5(str) {
    return (0, crypto_1.createHash)('md5').update(str).digest('hex');
}
