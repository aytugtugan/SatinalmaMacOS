$dest = Join-Path $env:USERPROFILE 'Desktop\Satinalma-Setup'
$scPath = Join-Path $env:USERPROFILE 'Desktop\Satinalma - Başlat.lnk'
$WshShell = New-Object -ComObject WScript.Shell
$sc = $WshShell.CreateShortcut($scPath)
$sc.TargetPath = Join-Path $dest 'electron.exe'
$sc.WorkingDirectory = $dest
$sc.IconLocation = $sc.TargetPath + ',0'
$sc.Save()
Write-Output 'Shortcut created: ' + $scPath
