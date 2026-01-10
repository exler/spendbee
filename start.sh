#!/bin/bash

# Spendbee Development Startup Script

echo "🐝 Starting Spendbee..."
echo ""

# Check if backend dependencies are installed
if [ ! -d "backend/node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    cd backend && bun install && cd ..
    echo ""
fi

# Check if frontend dependencies are installed
if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd frontend && npm install && cd ..
    echo ""
fi

# Check if database exists
if [ ! -f "backend/spendbee.db" ]; then
    echo "🗄️  Setting up database..."
    cd backend
    bun run db:generate
    bun run db:migrate
    cd ..
    echo ""
fi

echo "🚀 Starting servers..."
echo ""
echo "Backend will run at: http://localhost:3000"
echo "Frontend will run at: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Start backend in background
cd backend && bun run dev &
BACKEND_PID=$!

# Start frontend in background
cd frontend && npm run dev &
FRONTEND_PID=$!

# Wait for Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT

# Wait for both processes
wait
