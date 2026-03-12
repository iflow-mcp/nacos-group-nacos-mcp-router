"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseRerankProcessor = void 0;
/**
 * Base class for rerank processors implementing the chain of responsibility pattern
 */
class BaseRerankProcessor {
    nextProcessor = null;
    setNext(next) {
        this.nextProcessor = next;
        return next;
    }
    process(results, options) {
        if (this.nextProcessor) {
            return this.nextProcessor.process(results, options);
        }
        return results;
    }
    /**
     * Helper to safely call the next processor in the chain
     */
    next(results, options) {
        if (this.nextProcessor) {
            return this.nextProcessor.process(results, options);
        }
        return results;
    }
}
exports.BaseRerankProcessor = BaseRerankProcessor;
