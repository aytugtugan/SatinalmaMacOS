$lnkPath = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Satin Alma Rapor.lnk'
if (Test-Path $lnkPath) {
  $s = (New-Object -ComObject WScript.Shell).CreateShortcut($lnkPath)
  Write-Output "TargetPath: $($s.TargetPath)"
  Write-Output "IconLocation: $($s.IconLocation)"
} else {
  Write-Output 'Shortcut not found'
}