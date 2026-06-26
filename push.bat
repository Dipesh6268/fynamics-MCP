@echo off
git init
git config user.email "bot@example.com"
git config user.name "Bot"
git add .
git commit -m "Initial commit"
git branch -M main
git remote remove origin 2>nul
git remote add origin https://github.com/Dipesh6268/fynamics-MCP.git
git push -u origin main
