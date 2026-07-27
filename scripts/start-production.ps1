$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
$web = Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','start' -PassThru -WindowStyle Hidden
$worker = Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','worker' -PassThru -WindowStyle Hidden
Write-Host "Digital Verse web PID: $($web.Id); refresh worker PID: $($worker.Id)"
Wait-Process -Id $web.Id,$worker.Id
