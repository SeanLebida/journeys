#!/usr/bin/env bash
# Journeys Desktop Launcher
# Launches the most recent build of Journeys as a desktop app.

set -e

# Resolve the application root path via symlink or direct path
JOURNEYS_LINK="$HOME/.local/share/journeys/latest"
if [ -L "$JOURNEYS_LINK" ] || [ -d "$JOURNEYS_LINK" ]; then
    JOURNEYS_DIR="$(readlink -f "$JOURNEYS_LINK")"
else
    JOURNEYS_DIR="/mnt/FastStorage/SynologyDrive/Design Work/Github/Apps/Journeys"
fi

DIST_DIR="$JOURNEYS_DIR/dist"
PORT=4173

# Ensure node & npm are available in PATH
export PATH="$PATH:/usr/local/bin:/usr/bin:$HOME/.local/bin"

# If dist/index.html doesn't exist yet, trigger a build automatically
if [ ! -f "$DIST_DIR/index.html" ]; then
    echo "[Journeys Launcher] Building application..."
    cd "$JOURNEYS_DIR"
    npm run build
fi

# Check if server is already running on PORT
SERVER_RUNNING=0
if python3 -c "import socket; s = socket.socket(); s.settimeout(0.5); exit(0 if s.connect_ex(('127.0.0.1', $PORT)) == 0 else 1)" 2>/dev/null; then
    SERVER_RUNNING=1
fi

if [ "$SERVER_RUNNING" -eq 0 ]; then
    echo "[Journeys Launcher] Starting local preview server on http://127.0.0.1:$PORT..."
    cd "$JOURNEYS_DIR"
    nohup npx vite preview --port $PORT --host 127.0.0.1 > /tmp/journeys-preview.log 2>&1 & disown
    
    # Wait up to 5 seconds for server readiness
    for i in {1..25}; do
        if python3 -c "import socket; s = socket.socket(); s.settimeout(0.5); exit(0 if s.connect_ex(('127.0.0.1', $PORT)) == 0 else 1)" 2>/dev/null; then
            SERVER_RUNNING=1
            break
        fi
        sleep 0.2
    done
fi

URL="http://127.0.0.1:$PORT"

# Launch in application mode if Chrome/Chromium is available, else default browser
if command -v google-chrome-stable >/dev/null 2>&1; then
    exec google-chrome-stable --app="$URL" --user-data-dir="$HOME/.config/journeys-app-profile" "$@"
elif command -v google-chrome >/dev/null 2>&1; then
    exec google-chrome --app="$URL" --user-data-dir="$HOME/.config/journeys-app-profile" "$@"
elif command -v chromium >/dev/null 2>&1; then
    exec chromium --app="$URL" --user-data-dir="$HOME/.config/journeys-app-profile" "$@"
elif command -v firefox >/dev/null 2>&1; then
    exec firefox --new-window "$URL" "$@"
elif command -v xdg-open >/dev/null 2>&1; then
    exec xdg-open "$URL" "$@"
else
    echo "[Journeys Launcher] Journeys web server is running at $URL"
fi
