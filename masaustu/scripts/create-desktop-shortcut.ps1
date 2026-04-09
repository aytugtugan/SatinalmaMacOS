$ws = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$lnkPath = Join-Path $desktop 'Satin Alma Rapor.lnk'
$target = 'C:\Users\acemoglu\AppData\Local\Programs\Satin Alma Rapor\Satin Alma Rapor.exe'
$icon = 'C:\Users\acemoglu\AppData\Local\Programs\Satin Alma Rapor\uninstallerIcon.ico'

$ws2 = New-Object -ComObject WScript.Shell
$lnk = $ws2.CreateShortcut($lnkPath)
$lnk.TargetPath = $target
$lnk.WorkingDirectory = Split-Path $target -Parent
$lnk.IconLocation = $icon
$lnk.Save()
Write-Output "created: $lnkPath -> $target | icon: $icon"