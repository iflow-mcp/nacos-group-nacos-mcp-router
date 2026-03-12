const { spawn } = require('child_process');
const path = require('path');

const testDir = path.join(__dirname, 'src/typescript');
const serverPath = path.join(testDir, 'dist/stdio.js');

console.log('Starting MCP server with detailed logging...');
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
  const text = data.toString();
  output += text;
  console.log('STDOUT:', text);
});

server.stderr.on('data', (data) => {
  const text = data.toString();
  errorOutput += text;
  console.log('STDERR:', text);
});

server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});

server.on('exit', (code, signal) => {
  console.log(`Server exited with code ${code}, signal ${signal}`);
  console.log('Final output:', output);
  console.log('Final error:', errorOutput);
});

// Wait a bit for server to start
setTimeout(() => {
  console.log('\n=== Sending initialize request ===');
  const initRequest = JSON.stringify({
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
  });
  console.log('Sending:', initRequest);
  server.stdin.write(initRequest + '\n');
}, 2000);

// Wait for response
setTimeout(() => {
  console.log('\n=== Sending initialized notification ===');
  const initializedNotification = JSON.stringify({
    jsonrpc: '2.0',
    method: 'notifications/initialized'
  });
  console.log('Sending:', initializedNotification);
  server.stdin.write(initializedNotification + '\n');
}, 3000);

// Request tools list
setTimeout(() => {
  console.log('\n=== Sending tools/list request ===');
  const listToolsRequest = JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {}
  });
  console.log('Sending:', listToolsRequest);
  server.stdin.write(listToolsRequest + '\n');
}, 4000);

// Give it time to respond
setTimeout(() => {
  console.log('\n=== Test completed ===');
  console.log('Total stdout length:', output.length);
  console.log('Total stderr length:', errorOutput.length);
  server.kill();
  process.exit(0);
}, 8000);