#!/bin/bash
# ============================================
# Overwatch — Startup Script
# Launches backend (FastAPI) and frontend (Next.js) concurrently
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/deeptrace"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     DeepTrace AI — Command Center        ║${NC}"
echo -e "${CYAN}║  Incident Command & Evidence Platform    ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""

# --- Start Backend ---
echo -e "${YELLOW}[1/2]${NC} Starting FastAPI backend on port 8000..."
cd "$BACKEND_DIR"

if [ ! -d ".venv" ]; then
    echo -e "${RED}Error: Virtual environment not found. Run:${NC}"
    echo "  cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
    exit 1
fi

source .venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
echo -e "${GREEN}✓ Backend started (PID: $BACKEND_PID)${NC}"

# --- Start Frontend ---
echo -e "${YELLOW}[2/2]${NC} Starting Next.js frontend on port 3000..."
cd "$FRONTEND_DIR"
npm run dev &
FRONTEND_PID=$!
echo -e "${GREEN}✓ Frontend started (PID: $FRONTEND_PID)${NC}"

# --- Start Ollama ---
echo -e "${YELLOW}[3/4]${NC} Starting Local AI Backend (Ollama) on port 11435..."
OLLAMA_HOST=127.0.0.1:11435 ollama serve &
OLLAMA_PID=$!
echo -e "${YELLOW}Waiting for Ollama to initialize...${NC}"
sleep 3
echo -e "${GREEN}✓ Ollama started (PID: $OLLAMA_PID)${NC}"

# --- Start Chatbot ---
echo -e "${YELLOW}[4/4]${NC} Starting AI Chatbot on port 3001..."
CHATBOT_DIR="/home/yagami/Desktop/Nova - Gilani/chatbot-ollama"
cd "$CHATBOT_DIR"
if [ -d "node_modules" ]; then
    PORT=3001 npm start &
    CHATBOT_PID=$!
    echo -e "${GREEN}✓ Chatbot started (PID: $CHATBOT_PID)${NC}"
else
    echo -e "${RED}Warning: Chatbot not installed properly. Skipping...${NC}"
    CHATBOT_PID=""
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN} DeepTrace AI & Nova Chatbot running!${NC}"
echo -e "${CYAN} Frontend: ${NC}http://localhost:3000"
echo -e "${CYAN} Chatbot:  ${NC}http://localhost:3001"
echo -e "${CYAN} Backend:  ${NC}http://localhost:8000"
echo -e "${CYAN} API Docs: ${NC}http://localhost:8000/docs"
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"

# Trap Ctrl+C to kill all processes
trap "echo -e '\n${RED}Shutting down systems...${NC}'; kill $BACKEND_PID $FRONTEND_PID $OLLAMA_PID $CHATBOT_PID 2>/dev/null; exit 0" SIGINT SIGTERM

# Wait for either process to exit
wait
