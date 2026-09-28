#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Load environment variables from .env file
if [ -f .env ]; then
  export $(cat .env | grep -v '#' | awk '/=/ {print $1}')
fi

# Lock dependencies without updating them
echo "Locking dependencies..."
poetry lock --no-update

# Build and run the Docker containers
echo "Building and starting Docker containers..."
docker-compose -f docker-compose-local-nodb.yml up --build

# Print a success message
echo "Local development environment is up and running."