#!/usr/bin/env python3
import sys

file_path = '/app/auto-mcp-upload/data/23145/src/typescript/src/mcp_manager.ts'

with open(file_path, 'r') as f:
    content = f.read()

# 找到并替换catch块
old_code = '''} catch (error) {
      logger.error("Failed to update MCP servers:", error);
      throw error;
    }'''

new_code = '''} catch (error) {
      logger.warn("Failed to update MCP servers from Nacos, running in degraded mode:", error);
      // Don't throw error, just log it and continue in degraded mode
    }'''

if old_code in content:
    content = content.replace(old_code, new_code)
    with open(file_path, 'w') as f:
        f.write(content)
    print("Successfully modified mcp_manager.ts")
else:
    print("Pattern not found in mcp_manager.ts")
    sys.exit(1)