$ws = New-Object -ComObject WScript.Shell
$lnkPath = "$env:USERPROFILE\Desktop\Satin Alma Rapor.lnk"
if (Test-Path $lnkPath) {
  $lnk = $ws.CreateShortcut($lnkPath)
  $lnk.IconLocation = 'C:\Users\acemoglu\AppData\Local\Programs\Satin Alma Rapor\uninstallerIcon.ico'
  $lnk.Save()
  Write-Output "shortcut-updated"
} else {
  Write-Output "shortcut-not-found"
}

# Restart Explorer to refresh icon cache
try {
  Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 1
  Start-Process explorer
  Write-Output "explorer-restarted"
} catch {
  Write-Output "explorer-restart-failed: $_"
}
