#!/bin/sh

echo "Waiting for PostgreSQL to start..."
sleep 10

echo "Running database migrations..."
npm run migrate

echo "Seeding database with test data..."
npm run seed

echo "Starting application..."
npm start
