#!/usr/bin/env python3
import sys

file_path = '/app/auto-mcp-upload/data/23145/src/typescript/src/mcp_manager.ts'

with open(file_path, 'r') as f:
    content = f.read()

# 找到并替换updateNow方法
old_code = '''private async updateNow(): Promise<void> {
    try {
      const mcpServers = await this.nacosClient.getMcpServers();
      logger.debug(`get mcp server list from nacos, size: ${mcpServers.length}`);'''

new_code = '''private async updateNow(): Promise<void> {
    try {
      const mcpServers = await this.nacosClient.getMcpServers();
      logger.debug(`get mcp server list from nacos, size: ${mcpServers.length}`);'''

if old_code in content:
    content = content.replace(old_code, new_code)
    # 添加catch块来处理错误
    # 找到updateNow方法的结束位置
    import re
    # 查找updateNow方法的完整内容
    pattern = r'(private async updateNow\(\): Promise<void> \{.*?)(\n  \})\n'
    match = re.search(pattern, content, re.DOTALL)
    if match:
        method_body = match.group(1)
        # 检查是否已经有catch块
        if '} catch' not in method_body:
            # 在方法末尾添加catch块
            new_method = method_body + '''\n    } catch (error) {
      logger.warn(`Failed to update MCP servers from Nacos: ${error}`);
      // Don't throw error, just log it and continue in degraded mode
    }
  }'''
            content = content.replace(match.group(0), new_method)
            print("Successfully modified mcp_manager.ts")
        else:
            print("updateNow already has error handling")
    else:
        print("Could not find updateNow method")
        sys.exit(1)
else:
    print("Pattern not found in mcp_manager.ts")
    sys.exit(1)

with open(file_path, 'w') as f:
    f.write(content)