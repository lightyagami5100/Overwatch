#!/bin/bash
# ============================================
# Overwatch Protocol (Flux v4.0) — Master Launcher
# Launches Backend (FastAPI), Frontend (Next.js), Ollama AI Engine,
# and Nova Chatbot (port 3001)
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/overwatch"
CHATBOT_DIR="${CHATBOT_DIR:-$SCRIPT_DIR/../chatbot-ollama}"
if [ ! -d "$CHATBOT_DIR" ]; then
    DETECTED_CHATBOT=$(find "$SCRIPT_DIR/.." -maxdepth 2 -type d -name "chatbot-ollama" 2>/dev/null | head -n 1)
    if [ -n "$DETECTED_CHATBOT" ]; then
        CHATBOT_DIR="$DETECTED_CHATBOT"
    fi
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║           OVERWATCH PROTOCOL v4.0 (FLUX)                 ║${NC}"
echo -e "${CYAN}║     All-in-One Cyber & OSINT Incident Command Station    ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# --- 1. Start Backend ---
echo -e "${YELLOW}[1/4]${NC} Launching FastAPI backend engine on port 8000..."
cd "$BACKEND_DIR"

if [ ! -d ".venv" ]; then
    echo -e "${RED}Error: Virtual environment not found. Creating one...${NC}"
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
else
    source .venv/bin/activate
fi

uvicorn main:app --reload --host 0.0.0.0 --port 8000 > /dev/null 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}✓ Backend started (PID: $BACKEND_PID) -> http://localhost:8000${NC}"

# --- 2. Start Frontend ---
echo -e "${YELLOW}[2/4]${NC} Launching Next.js 16 WebGL Command Station on port 3000..."
cd "$FRONTEND_DIR"
npm run dev > /dev/null 2>&1 &
FRONTEND_PID=$!
echo -e "${GREEN}✓ Frontend started (PID: $FRONTEND_PID) -> http://localhost:3000${NC}"

# --- 3. Start Ollama Local LLM (if installed) ---
if command -v ollama &> /dev/null; then
    echo -e "${YELLOW}[3/4]${NC} Starting Ollama Zero-Trust AI Engine on port 11435..."
    OLLAMA_HOST=127.0.0.1:11435 ollama serve > /dev/null 2>&1 &
    OLLAMA_PID=$!
    echo -e "${GREEN}✓ Ollama service running (PID: $OLLAMA_PID)${NC}"
else
    echo -e "${YELLOW}[3/4]${NC} Ollama binary not found globally. Backend fallback synthesis active."
    OLLAMA_PID=""
fi

# --- 4. Start Nova Chatbot on port 3001 ---
if [ -d "$CHATBOT_DIR" ]; then
    echo -e "${YELLOW}[4/4]${NC} Launching Nova AI Chatbot on port 3001..."
    cd "$CHATBOT_DIR"
    npx next dev -p 3001 > /dev/null 2>&1 &
    CHATBOT_PID=$!
    echo -e "${GREEN}✓ Nova Chatbot running (PID: $CHATBOT_PID) -> http://localhost:3001${NC}"
else
    CHATBOT_PID=""
fi

echo ""
echo -e "${PURPLE}══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  OVERWATCH PROTOCOL IS ACTIVE AND READY FOR ENGAGEMENT${NC}"
echo -e "${CYAN}  * Dashboard:     ${NC}http://localhost:3000"
echo -e "${CYAN}  * Nova AI:       ${NC}http://localhost:3001"
echo -e "${CYAN}  * API Backend:   ${NC}http://localhost:8000"
echo -e "${CYAN}  * API Swagger:   ${NC}http://localhost:8000/docs"
echo -e "${CYAN}  * Tool Catalog:  ${NC}1,000+ Tools Indexed (Omni-Tool Hub)"
echo -e "${PURPLE}══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to terminate all services${NC}"

# Trap Ctrl+C to clean shutdown
trap "echo -e '\n${RED}Terminating Overwatch services...${NC}'; kill $BACKEND_PID $FRONTEND_PID $OLLAMA_PID $CHATBOT_PID 2>/dev/null; exit 0" SIGINT SIGTERM

wait
