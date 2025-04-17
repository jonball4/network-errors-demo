#!/bin/bash

# Colors for better readability
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== EHOSTUNREACH Test Environment ===${NC}"

# Parse arguments
TEST_TYPE=""
SCENARIO=""
KEEP_ALIVE=""

# Display help
function show_help {
  echo "Usage: ./run.sh [options]"
  echo
  echo "Options:"
  echo "  --basic        Run only basic network-level tests"
  echo "  --k8s          Run only Kubernetes-like scenarios"
  echo "  --scenario=ID  Run a specific scenario by ID"
  echo "  --keep-alive   Keep container running after tests complete"
  echo "  --help         Show this help message"
  echo
  echo "Available scenarios:"
  echo "  basic-host-unreachable   - Direct connection to IP with iptables host-unreachable rule"
  echo "  basic-net-unreachable    - Direct connection to IP with no route to network"
  echo "  k8s-stale-endpoint       - NLB forwarding to terminated pod IP (stale endpoint)"
  echo "  k8s-pod-terminating      - Pod received SIGTERM and is shutting down TCP stack"
  echo "  k8s-network-policy       - Network policy blocking traffic between namespaces"
}

# Process command line arguments
for arg in "$@"; do
  case $arg in
    --basic)
      TEST_TYPE="--basic"
      shift
      ;;
    --k8s)
      TEST_TYPE="--k8s"
      shift
      ;;
    --scenario=*)
      SCENARIO="${arg}"
      shift
      ;;
    --keep-alive)
      KEEP_ALIVE="keep-alive"
      shift
      ;;
    --help)
      show_help
      exit 0
      ;;
    *)
      # unknown option
      ;;
  esac
done

# Check if help was requested
if [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
  show_help
  exit 0
fi

# Set a sensible default if no test type specified
if [ -z "$TEST_TYPE" ] && [ -z "$SCENARIO" ]; then
  echo -e "${YELLOW}No test type specified, running all tests${NC}"
  TEST_TYPE=""
fi

# Build and run the container
cd "$(dirname "$0")"
echo -e "${BLUE}Building test container...${NC}"
docker-compose build

echo -e "${BLUE}Running tests...${NC}"
docker run --rm --cap-add=NET_ADMIN network-errors-ehostunreach-test $TEST_TYPE $SCENARIO $KEEP_ALIVE

echo -e "${GREEN}Test complete.${NC}"
echo "To run specific scenarios: ./run.sh --scenario=SCENARIO_ID"
echo "To keep the container alive after tests: ./run.sh --keep-alive"