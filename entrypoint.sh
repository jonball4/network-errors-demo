#!/bin/bash
set -e

# Configure iptables to produce EHOSTUNREACH
echo "Setting up network conditions to force EHOSTUNREACH errors..."

# Create routing black holes with explicit host-unreach rejection
iptables -A OUTPUT -d 192.0.2.0/24 -j REJECT --reject-with host-unreach
iptables -A OUTPUT -d 198.51.100.0/24 -j REJECT --reject-with host-unreach
iptables -A OUTPUT -d 203.0.113.0/24 -j REJECT --reject-with host-unreach

echo
echo "Current iptables rules:"
iptables -L OUTPUT -v
echo

echo "Current routes:"
ip route list
echo

# Run specific test suite based on argument
if [ "$1" = "--basic" ]; then
  echo "Running basic network-level tests only..."
  node /app/test.js --basic
elif [ "$1" = "--k8s" ]; then
  echo "Running Kubernetes-like scenarios only..."
  node /app/test.js --k8s
elif [[ "$1" == "--scenario="* ]]; then
  SCENARIO="${1#--scenario=}"
  echo "Running specific scenario: $SCENARIO"
  node /app/test.js --scenario=$SCENARIO
else
  echo "Running full test suite..."
  node /app/test.js
fi

# If we get here and keep-alive is set, keep container running
if [ "$2" = "keep-alive" ]; then
  echo "Test complete. Container will remain running for debugging."
  echo "Run additional tests with: docker exec ehostunreach-test node /app/test.js [--basic|--k8s|--scenario=ID]"
  tail -f /dev/null
fi