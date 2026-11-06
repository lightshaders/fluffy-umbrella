Turball Offline

Run this folder through a local HTTP server. Opening index.html directly does
not work because the game uses JavaScript modules.

Linux/macOS:
  sh start-offline.sh

Or, from this folder:
  python3 -m http.server 8000 --bind 127.0.0.1

Then open http://127.0.0.1:8000 in a browser. Features that require Turball's
online services are unavailable without an internet connection.