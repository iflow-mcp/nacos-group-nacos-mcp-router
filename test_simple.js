const { spawn } = require('child_process');
const path = require('path');

const testDir = path.join(__dirname, 'src/typescript');
const serverPath = path.join(testDir, 'dist/stdio.js');

console.log('Starting MCP server...');
console.log('Server path:', serverPath);

const env = {
  ...process.env,
  NACOS_PASSWORD: 'test',
  NACOS_SERVER_ADDR: 'localhost:8848',
  NACOS_USERNAME: 'nacos'
};

const server = spawn('node', [serverPath], {
  cwd: testDir,
  env: env,
  stdio: ['pipe', 'pipe', 'pipe']
});

let output = '';
let errorOutput = '';

server.stdout.on('data', (data) => {
  output += data.toString();
  console.log('STDOUT:', data.toString());
});

server.stderr.on('data', (data) => {
  errorOutput += data.toString();
  console.log('STDERR:', data.toString());
});

server.on('error', (err) => {
  console.error('Server error:', err);
});

setTimeout(() => {
  console.log('Sending initialize request...');
  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'test',
        version: '1.0'
      }
    }
  };
  server.stdin.write(JSON.stringify(initRequest) + '\n');
}, 1000);

setTimeout(() => {
  console.log('Sending list_tools request...');
  const listToolsRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {}
  };
  server.stdin.write(JSON.stringify(listToolsRequest) + '\n');
}, 2000);

setTimeout(() => {
  console.log('Test completed. Output:', output);
  console.log('Error output:', errorOutput);
  server.kill();
  process.exit(0);
}, 5000);