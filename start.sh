#!/bin/bash

# Start script for LMS system

echo "=== Starting LMS System with Docker Compose ==="
echo ""

docker-compose up -d

echo ""
echo "Waiting for services to start..."
sleep 5

echo ""
echo "=== Services Status ==="
docker-compose ps

echo ""
echo "=== Access Points ==="
echo "Frontend: http://localhost:4200"
echo "Backend API: http://localhost:3000"
echo "Database: localhost:5432"
echo ""
echo "To view logs:"
echo "  docker-compose logs -f backend"
echo "  docker-compose logs -f frontend"
echo "  docker-compose logs -f postgres"
echo ""
echo "To stop services:"
echo "  docker-compose down"
