#!/usr/bin/env bash
# Install Ollama + a small local model for SOFA AI (100% offline after download)
set -euo pipefail

echo "=== SOFA AI — install local LLM (Ollama) ==="
echo ""

if ! command -v ollama >/dev/null 2>&1; then
  echo "Installing Ollama..."
  curl -fsSL https://ollama.com/install.sh | sh
else
  echo "Ollama already installed: $(command -v ollama)"
fi

echo ""
echo "Starting Ollama service (if needed)..."
if ! curl -sf http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  ollama serve >/tmp/ollama-sofa.log 2>&1 &
  sleep 2
fi

MODEL="${OLLAMA_MODEL:-llama3.2:3b}"
echo ""
echo "Pulling model: $MODEL  (one-time download; then works offline)"
ollama pull "$MODEL"

echo ""
echo "Done. Restart: npm run dev"
echo "SOFA AI will use Ollama at http://127.0.0.1:11434"
echo "Optional in .env.local:"
echo "  OLLAMA_URL=http://127.0.0.1:11434"
echo "  OLLAMA_MODEL=$MODEL"
