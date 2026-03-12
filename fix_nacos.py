#!/usr/bin/env python3
import sys

file_path = '/app/auto-mcp-upload/data/23145/src/typescript/src/nacos_http_client.ts'

with open(file_path, 'r') as f:
    content = f.read()

# 找到并替换isReady方法
old_code = '''async isReady(): Promise<boolean> {
    return new Promise((resolve) => {
      this.client.get('/nacos/v3/admin/ai/mcp/list').then((response) => {
        if (response.status === 200) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  }'''

new_code = '''async isReady(): Promise<boolean> {
    return new Promise((resolve) => {
      this.client.get('/nacos/v3/admin/ai/mcp/list').then((response) => {
        if (response.status === 200) {
          resolve(true);
        } else {
          resolve(false);
        }
      }).catch((error) => {
        // Connection failed, return false instead of throwing
        console.error('[NacosHttpClient] Connection failed:', error.message);
        resolve(false);
      });
    });
  }'''

if old_code in content:
    content = content.replace(old_code, new_code)
    with open(file_path, 'w') as f:
        f.write(content)
    print("Successfully modified nacos_http_client.ts")
else:
    print("Pattern not found in nacos_http_client.ts")
    sys.exit(1)