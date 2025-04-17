FROM node:20-slim

# Install necessary tools
RUN apt-get update && \
    apt-get install -y iptables iproute2 iputils-ping curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy test files
COPY ./network-errors/test.js /app/
COPY ./network-errors/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]