param([switch]$SkipInstall)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
if (-not (Test-Path '.env')) { Copy-Item -LiteralPath '.env.example' -Destination '.env'; Write-Host 'Created .env from placeholders. Review it before SQL mode.' }
if (-not $SkipInstall) { npm install }
Write-Host 'Local setup complete. Run npm run dev:all.'
