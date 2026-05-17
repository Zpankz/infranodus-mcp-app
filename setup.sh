#!/bin/bash
# setup.sh — deploy InfraNodus MCP App on exe.xyz VM
#
# Usage: ssh infranodus-mcp.exe.xyz 'cd ~/app && bash setup.sh'
#
# Prerequisites: exe.dev VM with Node.js (exeuntu image has it)
set -euo pipefail

echo "=== InfraNodus MCP App — exe.xyz Setup ==="

# 1. Install Node.js if not present (exeuntu has it)
if ! command -v node &>/dev/null; then
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi
echo "Node: $(node --version)"

# 2. Install dependencies
echo "Installing npm dependencies..."
npm install

# 3. Build the view (bundle HTML with vite)
echo "Building view..."
npm run build

# 4. Prompt for API key if not set
if [ -z "${INFRANODUS_API_KEY:-}" ]; then
    echo ""
    echo "INFRANODUS_API_KEY not set."
    echo "Set it with:"
    echo "  export INFRANODUS_API_KEY=your_key"
    echo ""
    echo "Or create a systemd environment file:"
    echo "  echo 'INFRANODUS_API_KEY=your_key' | sudo tee /etc/infranodus-mcp.env"
    echo ""
fi

# 5. Create systemd service for persistent running
echo "Creating systemd service..."
sudo tee /etc/systemd/system/infranodus-mcp.service > /dev/null << 'SVCEOF'
[Unit]
Description=InfraNodus MCP App Server
After=network.target

[Service]
Type=simple
User=exedev
WorkingDirectory=/home/exedev/app
EnvironmentFile=-/etc/infranodus-mcp.env
ExecStart=/usr/bin/node --import tsx main.ts
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SVCEOF

# 6. Install tsx globally for TypeScript execution
npm install -g tsx

# 7. Enable and start the service
sudo systemctl daemon-reload
sudo systemctl enable infranodus-mcp
sudo systemctl start infranodus-mcp

echo ""
echo "=== Setup complete ==="
echo ""
echo "MCP server running on port 3001"
echo ""
echo "Next steps from the exe.dev REPL:"
echo "  ssh exe.dev share port $(hostname) 3001"
echo "  ssh exe.dev share set-public $(hostname)"
echo ""
echo "Then connect in Claude Desktop:"
echo "  https://$(hostname).exe.xyz/mcp"
echo ""
echo "Check status:"
echo "  sudo systemctl status infranodus-mcp"
echo "  sudo journalctl -u infranodus-mcp -f"
