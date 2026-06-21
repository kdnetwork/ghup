Write-Host "ghup powershell script"

$exePath     = "%s" # current binary file
$newExe      = "%s" # temp binary file
$exePid      = %d
$restartArgs = @'
%s
'@ | ConvertFrom-Json #[]string{}

$autoRestart = %s #$true/$false

$workDir = "%s"

$psScriptPath = $MyInvocation.MyCommand.Definition

Write-Host "Waiting for PID: $exePid"

while ($true) {
    try {
        $p = Get-Process -Id $exePid -ErrorAction Stop
        Start-Sleep -Milliseconds 500
    } catch {
        break
    }
}

Write-Host "Process exited"

Move-Item -Force -Path $newExe -Destination $exePath

Write-Host "File copy completed"

if ($autoRestart -eq $true) {
    Write-Host "Restarting..."

    if ($restartArgs.Count -gt 0) {
        Start-Process -FilePath $exePath -ArgumentList $restartArgs -WorkingDirectory $workDir
    } else {
        Start-Process -FilePath $exePath -WorkingDirectory $workDir
    }
}

Remove-Item -Force $psScriptPath
