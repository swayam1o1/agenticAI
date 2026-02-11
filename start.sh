#!/bin/bash
# Agentic Study Buddy - Quick Start Script

echo "🚀 Starting Agentic Study Buddy..."
echo ""

# Check if Ollama is running
if ! curl -s http://127.0.0.1:11434/api/tags &>/dev/null; then
  echo "⚠️  Ollama is not running!"
  echo "   Start it with: ollama serve"
  echo "   Then run this script again."
  exit 1
fi

echo "✅ Ollama is running"

# Start backend
echo "🔧 Starting backend on http://127.0.0.1:8001..."
cd backend
/usr/bin/python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --app-dir . &
BACKEND_PID=$!
cd ..

sleep 3

# Test backend
if curl -s http://127.0.0.1:8001/api/health &>/dev/null; then
  echo "✅ Backend is running"
else
  echo "❌ Backend failed to start"
  kill $BACKEND_PID 2>/dev/null
  exit 1
fi

# Start frontend
echo "🎨 Starting frontend on http://127.0.0.1:5173..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Agentic Study Buddy is ready!"
echo ""
echo "   Frontend: http://127.0.0.1:5173"
echo "   Backend:  http://127.0.0.1:8001"
echo "   Health:   http://127.0.0.1:8001/api/health"
echo ""
echo "Press Ctrl+C to stop all services"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Wait for user interrupt
trap "echo ''; echo '🛑 Stopping services...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT
wait
