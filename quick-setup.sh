#!/bin/bash
cd /Users/shadownight/Desktop/angdip
chmod +x install.sh start.sh
echo "Installing dependencies..."
npm --prefix backend install
npm --prefix frontend install
echo "Done! Run './start.sh' to start the application"
