#!/usr/bin/env bash
# Stop what dev-up.sh started. With --reset also drop the database volume,
# so the next dev-up.sh applies the schema and imports the export again.
set -uo pipefail
cd "$(dirname "$0")"

stop() { # name
  local f=".dev/$1.pid"
  if [ -f "$f" ]; then
    local pid; pid=$(cat "$f")
    if kill -0 "$pid" 2>/dev/null; then
      kill -TERM -- "-$pid" 2>/dev/null   # whole process group: mvn+java, npm+sh+vite
      kill -TERM "$pid" 2>/dev/null
      echo "$1: stopped (pid $pid)"
    else
      echo "$1: not running"
    fi
    rm -f "$f"
  else
    echo "$1: not running"
  fi
}

stop frontend
stop backend
# anything that escaped the pid files
pkill -f 'com.brightpath.booking.BookingApplication' 2>/dev/null || true
pkill -f 'spring-boot:run' 2>/dev/null || true
pkill -f "$PWD/frontend/node_modules" 2>/dev/null || true

if [ "${1:-}" = "--reset" ]; then
  docker compose down -v >/dev/null && echo "db: stopped, volume dropped (next dev-up.sh re-imports the export)"
else
  docker compose stop db >/dev/null && echo "db: stopped (data kept; use --reset to start over)"
fi
