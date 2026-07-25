# Run this script explicitly from an elevated PowerShell session. It is never called by setup scripts.
# New-NetFirewallRule -DisplayName 'Digital Verse Web' -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Domain,Private
Write-Host 'Review the commented New-NetFirewallRule command, then uncomment and run as Administrator if company policy permits.'
