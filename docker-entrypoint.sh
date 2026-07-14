#!/bin/sh
set -e

if [ -n "$OLLAMA_PULL_MODELS" ]; then
  (
    echo "Waiting for Ollama at $OLLAMA_HOST..."
    until curl -sf "${OLLAMA_HOST}/api/tags" >/dev/null 2>&1; do
      sleep 3
    done
    for model in $OLLAMA_PULL_MODELS; do
      echo "Pulling model: $model"
      curl -sf -X POST "${OLLAMA_HOST}/api/pull" \
        -H 'Content-Type: application/json' \
        -d "{\"name\":\"$model\"}" >/dev/null || true
    done
    echo "Model pull finished (or skipped on error)."
  ) &
fi

exec node server/index.js