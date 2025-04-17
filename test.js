/**
 * EHOSTUNREACH Demonstration Suite
 * 
 * This script provides both simple and realistic Kubernetes-like scenarios
 * that produce EHOSTUNREACH errors in different ways.
 */

const net = require('net');
const http = require('http');
const superagent = require('superagent');

// Configuration
const TEST_IPS = {
  hostUnreach: '192.0.2.5',      // TEST-NET-1 block with host-unreach rule
  netUnreach: '240.0.0.1',       // Class E reserved address
};

// Local proxy simulation ports
const PROXY_PORT = 8080;
const TARGET_PORT = 8081;
const TARGET_HOST = 'localhost';

// Server references for cleanup
let proxyServer = null;
let targetServer = null;

// Scenario definitions
const scenarios = [
  // Basic network-level scenarios
  {
    id: 'basic-host-unreachable',
    name: 'Basic EHOSTUNREACH Test',
    description: 'Direct connection to IP with iptables host-unreachable rule',
    setup: () => Promise.resolve(),
    test: testBasicHostUnreachable,
    teardown: () => Promise.resolve(),
    category: 'basic'
  },
  {
    id: 'basic-net-unreachable',
    name: 'Basic Network Unreachable Test',
    description: 'Direct connection to IP with no route to network',
    setup: () => Promise.resolve(),
    test: testBasicNetUnreachable, 
    teardown: () => Promise.resolve(),
    category: 'basic'
  },
  
  // Kubernetes-like scenarios
  {
    id: 'k8s-stale-endpoint',
    name: 'Kubernetes NLB Stale Endpoint',
    description: 'NLB forwarding to terminated pod IP (stale endpoint)',
    setup: setupStaleEndpointScenario,
    test: testServiceCall,
    teardown: teardownAllServers,
    category: 'k8s'
  },
  {
    id: 'k8s-pod-terminating',
    name: 'Kubernetes Pod Terminating',
    description: 'Pod received SIGTERM and is shutting down TCP stack',
    setup: setupTerminatingPodScenario,
    test: testServiceCall,
    teardown: teardownAllServers,
    category: 'k8s'
  },
  {
    id: 'k8s-network-policy',
    name: 'Kubernetes Network Policy Block',
    description: 'Network policy blocking traffic between namespaces',
    setup: setupNetworkPolicyScenario,
    test: testServiceCall,
    teardown: teardownAllServers,
    category: 'k8s'
  },
];

// Helper functions
function divider(title) {
  console.log('\n' + '='.repeat(80));
  console.log(title);
  console.log('='.repeat(80));
}

function sectionDivider(title) {
  console.log('\n' + '-'.repeat(40));
  console.log(title);
  console.log('-'.repeat(40));
}

// Main function
async function runTests() {
  divider('EHOSTUNREACH ERROR TEST SUITE');
  
  // Filter scenarios based on command line args if provided
  let scenariosToRun = scenarios;
  const args = process.argv.slice(2);
  if (args.includes('--basic')) {
    scenariosToRun = scenarios.filter(s => s.category === 'basic');
  } else if (args.includes('--k8s')) {
    scenariosToRun = scenarios.filter(s => s.category === 'k8s');
  } else if (args.some(arg => arg.startsWith('--scenario='))) {
    const scenarioId = args.find(arg => arg.startsWith('--scenario=')).split('=')[1];
    scenariosToRun = scenarios.filter(s => s.id === scenarioId);
  }
  
  console.log(`Running ${scenariosToRun.length} scenarios\n`);
  
  for (const scenario of scenariosToRun) {
    divider(`SCENARIO: ${scenario.name}`);
    console.log(scenario.description);
    
    try {
      await scenario.setup();
      await scenario.test();
    } catch (err) {
      console.error(`Error in scenario ${scenario.name}:`, err);
    } finally {
      await scenario.teardown();
    }
    
    // Brief pause between scenarios
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  divider('TEST SUITE COMPLETE');
}

//==============================================================================
// BASIC NETWORK-LEVEL TESTS
//==============================================================================

// Basic EHOSTUNREACH test via iptables rule
async function testBasicHostUnreachable() {
  sectionDivider('Direct Socket Connection to IP with host-unreachable rule');
  console.log(`Connecting to ${TEST_IPS.hostUnreach}:12345...`);
  
  return new Promise(resolve => {
    const socket = new net.Socket();
    
    socket.setTimeout(5000);
    
    socket.on('connect', () => {
      console.log('UNEXPECTED: Connection succeeded!');
      socket.destroy();
      resolve();
    });
    
    socket.on('error', (err) => {
      console.log('\nError details:');
      console.log(`- Code: ${err.code}`);
      console.log(`- Message: ${err.message}`);
      console.log(`- Syscall: ${err.syscall}`);
      console.log(`- Address: ${err.address}`);
      console.log(`- Port: ${err.port}`);
      
      if (err.code === 'EHOSTUNREACH') {
        console.log('\n✅ Successfully received EHOSTUNREACH error!');
      } else {
        console.log(`\nReceived error code: ${err.code} (not EHOSTUNREACH)`);
      }
      
      socket.destroy();
      resolve();
    });
    
    socket.on('timeout', () => {
      console.log('\nConnection attempt timed out');
      socket.destroy();
      resolve();
    });
    
    socket.connect(12345, TEST_IPS.hostUnreach);
  });
}

// Basic network unreachable test
async function testBasicNetUnreachable() {
  sectionDivider('Direct Socket Connection to IP with no route to network');
  console.log(`Connecting to ${TEST_IPS.netUnreach}:12345...`);
  
  return new Promise(resolve => {
    const socket = new net.Socket();
    
    socket.setTimeout(5000);
    
    socket.on('connect', () => {
      console.log('UNEXPECTED: Connection succeeded!');
      socket.destroy();
      resolve();
    });
    
    socket.on('error', (err) => {
      console.log('\nError details:');
      console.log(`- Code: ${err.code}`);
      console.log(`- Message: ${err.message}`);
      console.log(`- Syscall: ${err.syscall}`);
      console.log(`- Address: ${err.address}`);
      console.log(`- Port: ${err.port}`);
      
      if (err.code === 'ENETUNREACH') {
        console.log('\n✅ Successfully received ENETUNREACH error!');
      } else if (err.code === 'EHOSTUNREACH') {
        console.log('\n✅ Received EHOSTUNREACH instead of ENETUNREACH (OS-dependent)');
      } else {
        console.log(`\nReceived error code: ${err.code} (not ENETUNREACH or EHOSTUNREACH)`);
      }
      
      socket.destroy();
      resolve();
    });
    
    socket.on('timeout', () => {
      console.log('\nConnection attempt timed out (typical for non-routable networks)');
      socket.destroy();
      resolve();
    });
    
    socket.connect(12345, TEST_IPS.netUnreach);
  });
}

//==============================================================================
// KUBERNETES-LIKE SIMULATION TESTS
//==============================================================================

// Target server creation
function createTargetServer(options = {}) {
  const { acceptConnections = true, respondToRequests = true, delayBeforeReset = 0 } = options;
  
  return new Promise((resolve) => {
    targetServer = net.createServer((socket) => {
      console.log('  Target received connection');
      
      if (!acceptConnections) {
        console.log('  Target refusing connection');
        socket.destroy();
        return;
      }
      
      socket.on('data', (data) => {
        console.log(`  Target received data: ${data.toString().split('\\n')[0]}`);
        
        if (respondToRequests) {
          setTimeout(() => {
            socket.write('HTTP/1.1 200 OK\r\n');
            socket.write('Content-Type: text/plain\r\n');
            socket.write('Connection: close\r\n');
            socket.write('\r\n');
            socket.write('OK');
            socket.end();
          }, 100);
        } else if (delayBeforeReset > 0) {
          setTimeout(() => {
            console.log('  Target resetting connection after delay');
            socket.destroy();
          }, delayBeforeReset);
        }
      });
    });
    
    targetServer.listen(TARGET_PORT, () => {
      console.log(`  Target server listening on port ${TARGET_PORT}`);
      resolve();
    });
  });
}

// Proxy server to simulate load balancer
function createProxyServer(options = {}) {
  const { targetHost = TARGET_HOST, targetPort = TARGET_PORT, forwardTraffic = true, simulateStaleEndpoint = false } = options;
  
  return new Promise((resolve) => {
    proxyServer = http.createServer((req, res) => {
      console.log('  Proxy received request');
      
      if (!forwardTraffic) {
        console.log('  Proxy configured to drop traffic');
        res.writeHead(503);
        res.end('Proxy dropping traffic');
        return;
      }
      
      // If simulating stale endpoint, connect to non-existent endpoint
      const port = simulateStaleEndpoint ? 65333 : targetPort; // Almost certainly unused port
      
      console.log(`  Proxy forwarding to ${targetHost}:${port}`);
      
      // Use superagent to forward the request
      const method = req.method.toLowerCase();
      let proxyReq = superagent[method](`http://${targetHost}:${port}${req.url}`);
      
      // Copy headers from original request
      Object.entries(req.headers).forEach(([key, value]) => {
        proxyReq = proxyReq.set(key, value);
      });
      
      // Handle request body for POST/PUT requests
      if (['post', 'put', 'patch'].includes(method)) {
        let body = [];
        req.on('data', (chunk) => {
          body.push(chunk);
        });
        
        req.on('end', () => {
          body = Buffer.concat(body);
          
          proxyReq
            .send(body)
            .timeout(5000)
            .then(proxyRes => {
              res.writeHead(proxyRes.status, proxyRes.headers);
              res.end(proxyRes.text);
            })
            .catch(err => {
              handleProxyError(err, res);
            });
        });
      } else {
        // For GET/DELETE/HEAD requests
        proxyReq
          .timeout(5000)
          .then(proxyRes => {
            res.writeHead(proxyRes.status, proxyRes.headers);
            res.end(proxyRes.text);
          })
          .catch(err => {
            handleProxyError(err, res);
          });
      }
    });
    
    function handleProxyError(err, res) {
      console.log(`  Proxy error: ${err.code || err.status} - ${err.message}`);
      if (err.code === 'ECONNREFUSED') {
        res.writeHead(502);
        res.end('Connection Refused');
      } else if (err.code === 'EHOSTUNREACH') {
        res.writeHead(502);
        res.end('Host Unreachable');
      } else if (err.code === 'ETIMEDOUT' || err.timeout) {
        res.writeHead(504);
        res.end('Gateway Timeout');
      } else {
        res.writeHead(500);
        res.end(`Error: ${err.code || err.status}`);
      }
    }
    
    proxyServer.listen(PROXY_PORT, () => {
      console.log(`  Proxy server listening on port ${PROXY_PORT}`);
      resolve();
    });
  });
}

// Kubernetes scenario setups
async function setupStaleEndpointScenario() {
  sectionDivider('Setting up stale endpoint scenario');
  // Only create proxy, with routing to invalid endpoint
  await createProxyServer({ simulateStaleEndpoint: true });
}

async function setupTerminatingPodScenario() {
  sectionDivider('Setting up terminating pod scenario');
  // Target pod actively refuses connections
  await createTargetServer({ acceptConnections: false });
  await createProxyServer({ forwardTraffic: true });
}

async function setupNetworkPolicyScenario() {
  sectionDivider('Setting up network policy block scenario');
  // Here we simulate a network policy block using iptables in the entrypoint.sh script
  // Just create services and let the traffic be blocked by iptables
  await createTargetServer({ acceptConnections: true, respondToRequests: true });
  await createProxyServer({ targetHost: TEST_IPS.hostUnreach, forwardTraffic: true });
}

// Service call test for Kubernetes scenarios - refactored to use superagent
async function testServiceCall() {
  sectionDivider('Making service call through proxy');
  
  return new Promise((resolve) => {
    console.log('  Making HTTP request to proxy...');
    
    superagent
      .get(`http://localhost:${PROXY_PORT}/`)
      .timeout(5000)
      .then(res => {
        console.log(`  Response status: ${res.status}`);
        console.log(`  Response body: ${res.text}`);
        resolve();
      })
      .catch(err => {
        // Check for superagent error properties
        const errorCode = err.code || (err.response ? err.response.status : 'unknown');
        console.log(`  Request error: ${errorCode} - ${err.message}`);
        
        if (err.code === 'EHOSTUNREACH') {
          console.log('  ✅ Successfully received EHOSTUNREACH error!');
        } else if (err.code === 'ECONNREFUSED') {
          console.log('  ❌ Received ECONNREFUSED error instead of EHOSTUNREACH');
        } else if (err.code === 'ETIMEDOUT' || err.timeout) {
          console.log('  ❌ Received timeout instead of EHOSTUNREACH');
        }
        
        resolve();
      });
  });
}

// Server teardown
async function teardownAllServers() {
  sectionDivider('Tearing down servers');
  
  return new Promise((resolve) => {
    const closeProxy = proxyServer ? 
      new Promise(r => proxyServer.close(() => {
        console.log('  Proxy server closed');
        proxyServer = null;
        r();
      })) : 
      Promise.resolve();
      
    const closeTarget = targetServer ? 
      new Promise(r => targetServer.close(() => {
        console.log('  Target server closed');
        targetServer = null;
        r();
      })) : 
      Promise.resolve();
    
    Promise.all([closeProxy, closeTarget]).then(resolve);
  });
}

// Run all tests
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  runTests,
  scenarios
};