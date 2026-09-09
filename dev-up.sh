#!/usr/bin/env bash
# Start everything for local development: Postgres (Docker), backend (8080), frontend (5173).
# Logs and pids go to .dev/. Stop with ./dev-down.sh
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p .dev

echo "db: starting"
docker compose up -d db >/dev/null
for _ in $(seq 1 30); do
  docker compose exec -T db pg_isready -U brightpath >/dev/null 2>&1 && break
  sleep 1
done
docker compose exec -T db pg_isready -U brightpath >/dev/null 2>&1 || { echo "db: not ready after 30s"; exit 1; }
echo "db: ready on localhost:5432"

if [ -f .dev/backend.pid ] && kill -0 "$(cat .dev/backend.pid)" 2>/dev/null; then
  echo "backend: already running (pid $(cat .dev/backend.pid))"
else
  echo "backend: starting (log in .dev/backend.log)"
  (cd backend; nohup mvn -q spring-boot:run > ../.dev/backend.log 2>&1 & echo $! > ../.dev/backend.pid)
  for _ in $(seq 1 120); do
    curl -sf localhost:8080/api/tutors >/dev/null 2>&1 && break
    sleep 1
  done
  curl -sf localhost:8080/api/tutors >/dev/null 2>&1 || { echo "backend: not answering after 120s, see .dev/backend.log"; exit 1; }
  echo "backend: ready on http://localhost:8080"
  grep -h "Seed" .dev/backend.log | sed 's/.*SeedImporter *: /  /' || true
fi

if [ -d frontend ]; then
  if [ -f .dev/frontend.pid ] && kill -0 "$(cat .dev/frontend.pid)" 2>/dev/null; then
    echo "frontend: already running (pid $(cat .dev/frontend.pid))"
  else
    [ -d frontend/node_modules ] || (cd frontend && npm install --silent)
    echo "frontend: starting (log in .dev/frontend.log)"
    (cd frontend; nohup npm run dev > ../.dev/frontend.log 2>&1 & echo $! > ../.dev/frontend.pid)
    for _ in $(seq 1 60); do
      curl -sf localhost:5173 >/dev/null 2>&1 && break
      sleep 1
    done
    echo "frontend: http://localhost:5173"
  fi
else
  echo "frontend: not present yet, skipped"
fi
