# EHOSTUNREACH Error Demonstration Suite

This directory contains a comprehensive test environment for reproducing and analyzing EHOSTUNREACH errors, with scenarios ranging from simple network-level tests to realistic Kubernetes service-to-service failures.

## Quick Start

```bash
# Run all tests
cd /Users/jonball/dev/prime-microservices/packages/trade-falcon/test/network-errors
./run.sh

# Show options
./run.sh --help
```

## Available Scenarios

### Basic Network-Level Tests

These tests demonstrate fundamental EHOSTUNREACH errors using iptables:

* `basic-host-unreachable` - Direct connection to IP with host-unreachable rule
* `basic-net-unreachable` - Direct connection to IP with no route to network

### Kubernetes-Like Scenarios

These tests simulate realistic Kubernetes service failures:

* `k8s-stale-endpoint` - NLB forwarding to terminated pod IP (stale endpoint)
* `k8s-pod-terminating` - Pod received SIGTERM and is shutting down TCP stack
* `k8s-network-policy` - Network policy blocking traffic between namespaces

## Running Specific Tests

```bash
# Run only basic tests
./run.sh --basic

# Run only Kubernetes scenarios
./run.sh --k8s

# Run a specific scenario
./run.sh --scenario=k8s-stale-endpoint

# Keep container running for debugging
./run.sh --keep-alive
```

## Understanding EHOSTUNREACH vs ENETUNREACH

| Error Code     | Meaning                     | Linux Error Number | Description                                     |
|----------------|-----------------------------|--------------------|------------------------------------------------|
| EHOSTUNREACH   | Host Unreachable            | 113                | Route to network exists but host is unreachable |
| ENETUNREACH    | Network Unreachable         | 101                | No route exists to the specified network        |

## Common Production Causes

In Kubernetes with NLB, EHOSTUNREACH often occurs due to:

1. **Endpoint Staleness**: Network Load Balancer has outdated endpoints that no longer exist
   - The NLB forwards traffic to pod IPs that have been terminated
   - This happens during rolling updates or pod evictions

2. **Network Policy Issues**: Network policies blocking traffic between namespaces
   - Connection attempts fail at IP routing level with EHOSTUNREACH
   - Often intermittent if policies are applied during traffic

3. **Node Networking Issues**: When a node has network configuration problems
   - Occurs when a node can't route traffic to pods on other nodes
   - May happen during node draining/eviction

4. **Service Mesh Sidecar Problems**: When a service mesh proxy fails
   - Istio/Envoy sidecars can cause EHOSTUNREACH when misconfigured
   - Traffic routing rules may create unreachable routes

## Solution Patterns

To handle EHOSTUNREACH errors in your application:

1. **Retries with Exponential Backoff**: Implement retry logic for idempotent operations
   ```javascript
   async function fetchWithRetry(url, maxRetries = 3, initialDelay = 300) {
     let retries = 0;
     while (retries <= maxRetries) {
       try {
         return await fetch(url);
       } catch (err) {
         if (err.code === 'EHOSTUNREACH' && retries < maxRetries) {
           await new Promise(r => setTimeout(r, initialDelay * Math.pow(2, retries)));
           retries++;
           continue;
         }
         throw err;
       }
     }
   }
   ```

2. **Circuit Breaking**: Temporarily stop sending requests to failing endpoints
3. **Client-Side Load Balancing**: Implement client-side alternatives when load balancers fail
4. **Health Checking**: Pro-active endpoint health validation before sending requests