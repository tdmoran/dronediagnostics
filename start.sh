#!/bin/bash

# DroneDiagnostics Startup Script
# Usage: ./start.sh [backend|frontend|both]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

start_backend() {
    print_status "Starting Backend..."
    cd backend
    
    # Check if venv exists
    if [ ! -d "venv" ]; then
        print_status "Creating Python virtual environment..."
        python3 -m venv venv
    fi
    
    # Activate venv
    source venv/bin/activate
    
    # Install dependencies
    print_status "Installing Python dependencies..."
    pip install -q -r requirements.txt
    
    # Start server
    print_status "Starting FastAPI server on http://localhost:8000"
    python main.py &
    BACKEND_PID=$!
    echo $BACKEND_PID > .backend.pid
    cd ..
}

start_frontend() {
    print_status "Starting Frontend..."
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        print_status "Installing Node dependencies..."
        npm install
    fi
    
    # Start dev server
    print_status "Starting Next.js server on http://localhost:3000"
    npm run dev &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > .frontend.pid
}

stop_all() {
    print_status "Stopping services..."
    if [ -f .backend.pid ]; then
        kill $(cat .backend.pid) 2>/dev/null || true
        rm .backend.pid
    fi
    if [ -f .frontend.pid ]; then
        kill $(cat .frontend.pid) 2>/dev/null || true
        rm .frontend.pid
    fi
    print_status "All services stopped"
}

# Handle Ctrl+C
trap stop_all EXIT

# Main
MODE=${1:-both}

case $MODE in
    backend)
        start_backend
        print_status "Backend running. Press Ctrl+C to stop."
        wait
        ;;
    frontend)
        start_frontend
        print_status "Frontend running. Press Ctrl+C to stop."
        wait
        ;;
    both)
        start_backend
        sleep 2
        start_frontend
        print_status "Both services running!"
        print_status "- Backend: http://localhost:8000"
        print_status "- Frontend: http://localhost:3000"
        print_status "Press Ctrl+C to stop all services."
        wait
        ;;
    *)
        echo "Usage: ./start.sh [backend|frontend|both]"
        exit 1
        ;;
esac
