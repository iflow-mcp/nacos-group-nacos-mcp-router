"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryVectorDB = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const logger_1 = require("./logger");
let pipeline;
async function getPipeline() {
    if (!pipeline) {
        pipeline = (await import('@xenova/transformers')).pipeline;
    }
    return pipeline;
}
// Simplified VectorDB implementation without hnswlib-node dependency
class SimpleIndex {
    vectors = [];
    currentCount = 0;
    addPoint(vector, label) {
        this.vectors[label] = vector;
        this.currentCount = Math.max(this.currentCount, label + 1);
    }
    getCurrentCount() {
        return this.currentCount;
    }
    searchKnn(queryVector, k) {
        const distances = this.vectors.map((vec, idx) => {
            if (!vec)
                return { idx, dist: Infinity };
            // Cosine similarity
            const dotProduct = queryVector.reduce((sum, val, i) => sum + val * vec[i], 0);
            const normA = Math.sqrt(queryVector.reduce((sum, val) => sum + val * val, 0));
            const normB = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
            const similarity = dotProduct / (normA * normB);
            return { idx, dist: 1 - similarity };
        });
        distances.sort((a, b) => a.dist - b.dist);
        const topK = distances.slice(0, k).filter(d => d.dist !== Infinity);
        return {
            neighbors: topK.map(d => d.idx),
            distances: topK.map(d => d.dist)
        };
    }
    initIndex(maxElements) {
        this.vectors = new Array(maxElements);
        this.currentCount = 0;
    }
    writeIndexSync(filePath) {
        // Simplified: just save count
        const data = { count: this.currentCount, vectors: this.vectors.slice(0, this.currentCount) };
        fs_1.default.writeFileSync(filePath, JSON.stringify(data));
    }
    readIndexSync(filePath) {
        if (fs_1.default.existsSync(filePath)) {
            const data = JSON.parse(fs_1.default.readFileSync(filePath, 'utf-8'));
            this.vectors = data.vectors || [];
            this.currentCount = data.count || 0;
        }
    }
}
class MemoryVectorDB {
    index;
    metadatas = [];
    extractor = null;
    numDimensions;
    maxElements;
    spaceType;
    indexFile;
    metadataFile;
    modelName;
    constructor(options) {
        this.numDimensions = options.numDimensions;
        this.maxElements = options.maxElements || 10000;
        this.spaceType = options.spaceType || 'cosine';
        this.indexFile = options.indexFile || path_1.default.join(os_1.default.tmpdir(), 'nacos-mcp-router', 'my_hnsw_index.bin');
        this.metadataFile = options.metadataFile || path_1.default.join(os_1.default.tmpdir(), 'nacos-mcp-router', 'my_hnsw_metadata.json');
        this.modelName = options.modelName || 'Xenova/all-MiniLM-L6-v2';
        if (options.clearOnStart) {
            if (fs_1.default.existsSync(this.indexFile)) {
                fs_1.default.unlinkSync(this.indexFile);
                logger_1.logger.info(`[MemoryVectorDB] 已清除索引文件: ${this.indexFile}`);
            }
            if (fs_1.default.existsSync(this.metadataFile)) {
                fs_1.default.unlinkSync(this.metadataFile);
                logger_1.logger.info(`[MemoryVectorDB] 已清除元数据文件: ${this.metadataFile}`);
            }
        }
        this.index = new SimpleIndex();
        if (fs_1.default.existsSync(this.indexFile) && fs_1.default.existsSync(this.metadataFile)) {
            logger_1.logger.info(`[MemoryVectorDB] 加载已有索引: ${this.indexFile} 和元数据: ${this.metadataFile}`);
            this.index.readIndexSync(this.indexFile);
            this.metadatas = JSON.parse(fs_1.default.readFileSync(this.metadataFile, 'utf-8'));
        }
        else {
            logger_1.logger.info(`[MemoryVectorDB] 初始化新索引, 最大元素数: ${this.maxElements}`);
            this.index.initIndex(this.maxElements);
        }
    }
    async getEmbedding(text) {
        if (!this.extractor) {
            const _pipeline = await getPipeline();
            this.extractor = await _pipeline('feature-extraction', this.modelName);
        }
        const output = await this.extractor(text, { pooling: 'mean', normalize: true });
        return Array.from(output.data);
    }
    async add(text, metadata = {}) {
        logger_1.logger.info(`[MemoryVectorDB] 添加文本到向量库: ${text.slice(0, 30)}...`);
        const vector = await this.getEmbedding(text);
        const label = this.index.getCurrentCount();
        this.index.addPoint(vector, label);
        this.metadatas[label] = { ...metadata, text };
        logger_1.logger.info(`[MemoryVectorDB] 添加完成，label: ${label}`);
    }
    async search(query, k = 5) {
        logger_1.logger.info(`[MemoryVectorDB] 搜索: ${query.slice(0, 30)}...，topK=${k}`);
        const queryVector = await this.getEmbedding(query);
        const results = this.index.searchKnn(queryVector, k);
        logger_1.logger.info(`[MemoryVectorDB] 搜索完成，返回${results.neighbors.length}条结果`);
        return results.neighbors.map((label, i) => ({
            metadata: this.metadatas[label],
            label,
            distance: results.distances[i],
            similarity: 1 - results.distances[i]
        }));
    }
    save() {
        // 确保父目录存在
        const indexDir = path_1.default.dirname(this.indexFile);
        const metadataDir = path_1.default.dirname(this.metadataFile);
        if (!fs_1.default.existsSync(indexDir)) {
            fs_1.default.mkdirSync(indexDir, { recursive: true });
        }
        if (!fs_1.default.existsSync(metadataDir)) {
            fs_1.default.mkdirSync(metadataDir, { recursive: true });
        }
        this.index.writeIndexSync(this.indexFile);
        fs_1.default.writeFileSync(this.metadataFile, JSON.stringify(this.metadatas, null, 2));
        logger_1.logger.info(`[MemoryVectorDB] 索引和元数据已保存到: ${this.indexFile}, ${this.metadataFile}`);
    }
    load() {
        if (fs_1.default.existsSync(this.indexFile) && fs_1.default.existsSync(this.metadataFile)) {
            this.index.readIndexSync(this.indexFile);
            this.metadatas = JSON.parse(fs_1.default.readFileSync(this.metadataFile, 'utf-8'));
            logger_1.logger.info(`[MemoryVectorDB] 已加载索引和元数据`);
        }
        else {
            logger_1.logger.info(`[MemoryVectorDB] 未找到索引或元数据文件，无法加载`);
        }
    }
    getCount() {
        return this.index.getCurrentCount();
    }
}
exports.MemoryVectorDB = MemoryVectorDB;
