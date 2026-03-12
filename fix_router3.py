#!/usr/bin/env python3
import sys

file_path = '/app/auto-mcp-upload/data/23145/src/typescript/src/router.ts'

with open(file_path, 'r') as f:
    content = f.read()

# 找到并替换isReady检查的代码
old_code = '''const isReady = await this.nacosClient.isReady();
      if (!isReady) {
        logger.warn(`Nacos client is not ready or not connected, running in degraded mode. Please check the nacos server config.`);
        console.error('[WARN] Nacos client not ready, running in degraded mode');
      } else {
        logger.info(`nacosClient is ready: ${isReady}`);
      }'''

new_code = '''let isReady = false;
      try {
        isReady = await this.nacosClient.isReady();
      } catch (error) {
        console.error('[WARN] Nacos connection failed:', error);
        logger.warn(`Nacos connection failed: ${error}`);
      }
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
    # Print what we're looking for
    import re
    match = re.search(r'const isReady = await this\.nacosClient\.isReady\(\);.*?logger\.info\(`nacosClient is ready:.*?\);', content, re.DOTALL)
    if match:
        print("Found similar pattern:")
        print(match.group(0)[:200])
    else:
        print("Could not find any isReady pattern")
    sys.exit(1)