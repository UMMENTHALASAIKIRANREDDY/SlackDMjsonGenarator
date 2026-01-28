# Setup script for Slack DM Export Generator
# Run this script to install all dependencies

Write-Host "Installing dependencies for Slack DM Export Generator..." -ForegroundColor Green

# Install root dependencies
Write-Host "`nInstalling root dependencies..." -ForegroundColor Yellow
Set-Location $PSScriptRoot
npm install

# Install server dependencies
Write-Host "`nInstalling server dependencies..." -ForegroundColor Yellow
Set-Location server
npm install

# Install client dependencies
Write-Host "`nInstalling client dependencies..." -ForegroundColor Yellow
Set-Location ..\client
npm install

# Return to root
Set-Location ..

Write-Host "`nAll dependencies installed successfully!" -ForegroundColor Green
Write-Host "`nTo run the project, use: npm run dev" -ForegroundColor Cyan
