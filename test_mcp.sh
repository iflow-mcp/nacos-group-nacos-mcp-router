#!/bin/bash
cd /app/auto-mcp-upload/data/23145/src/typescript
export NACOS_PASSWORD=test
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | timeout 3 node dist/stdio.js 2>&1 || true