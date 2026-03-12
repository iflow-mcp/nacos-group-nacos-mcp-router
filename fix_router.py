#!/usr/bin/env python3
import sys

file_path = '/app/auto-mcp-upload/data/23145/src/typescript/src/router.ts'

with open(file_path, 'r') as f:
    content = f.read()

# 找到并替换Nacos检查的代码
old_code = '''const isReady = await this.nacosClient.isReady();
      if (!isReady) {
        throw new McpError(ErrorCode.InternalError, "Nacos client is not ready or not connected, please check the nacos server conifg");
      }
      logger.info(`nacosClient is ready: ${isReady}`);'''

new_code = '''const isReady = await this.nacosClient.isReady();
      if (!isReady) {
        logger.warn(`Nacos client is not ready or not connected, running in degraded mode. Please check the nacos server config.`);
        console.error('[WARN] Nacos client not ready, running in degraded mode');
      } else {
        logger.info(`nacosClient is ready: ${isReady}`);
      }'''

if old_code in content:
    content = content.replace(old_code, new_code)
    with open(file_path, 'w') as f:
        f.write(content)
    print("Successfully modified router.ts")
else:
    print("Pattern not found in router.ts")
    sys.exit(1)