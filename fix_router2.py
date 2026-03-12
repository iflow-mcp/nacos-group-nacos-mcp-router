#!/usr/bin/env python3
import sys

file_path = '/app/auto-mcp-upload/data/23145/src/typescript/src/router.ts'

with open(file_path, 'r') as f:
    content = f.read()

# 找到并替换连接部分的代码
old_code = '''logger.info(`registerMcpTools`);
      this.registerMcpTools();
      if (replaceTransport) {
        this.mcpServer!.connect(replaceTransport);
      } else {
        const transport = new StdioServerTransport();
        logger.info(`transport: ${transport}`);
        await this.mcpServer!.connect(transport);
        logger.info(`mcpServer is connected, transport: ${JSON.stringify(transport)}`);
      }
    } catch (error) {
      logger.error("Failed to start Nacos MCP Router:", error);
      // throw error;
    }'''

new_code = '''logger.info(`registerMcpTools`);
      this.registerMcpTools();
      console.error('[DEBUG] About to connect to transport...');
      if (replaceTransport) {
        console.error('[DEBUG] Using replace transport');
        this.mcpServer!.connect(replaceTransport);
      } else {
        console.error('[DEBUG] Creating stdio transport...');
        const transport = new StdioServerTransport();
        logger.info(`transport: ${transport}`);
        console.error('[DEBUG] Transport created, connecting...');
        await this.mcpServer!.connect(transport);
        console.error('[DEBUG] Connected successfully');
        logger.info(`mcpServer is connected, transport: ${JSON.stringify(transport)}`);
      }
    } catch (error) {
      console.error('[ERROR] Error in start method:', error);
      logger.error("Failed to start Nacos MCP Router:", error);
      // throw error;
    }'''

if old_code in content:
    content = content.replace(old_code, new_code)
    with open(file_path, 'w') as f:
        f.write(content)
    print("Successfully modified router.ts")
else:
    print("Pattern not found in router.ts")
    # Debug: print what we're looking for
    print("Looking for:")
    print(old_code[:100])
    sys.exit(1)