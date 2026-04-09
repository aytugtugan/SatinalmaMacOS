$shell = New-Object -ComObject WScript.Shell
$shortcutPath = 'C:\Users\acemoglu\Desktop\Satin Alma Rapor.lnk'

if (Test-Path $shortcutPath) {
    $shortcut = $shell.CreateShortCut($shortcutPath)
    Write-Host "Mevcut Target: $($shortcut.TargetPath)"
    Write-Host "Mevcut Icon: $($shortcut.IconLocation)"
    
    $iconPath = 'C:\Users\acemoglu\Desktop\Satinalma\assets\icon.ico'
    $shortcut.IconLocation = $iconPath
    $shortcut.Save()
    
    Write-Host "Simge güncellenmiş: $iconPath"
} else {
    Write-Host "Shortcut bulunamadı: $shortcutPath"
}
