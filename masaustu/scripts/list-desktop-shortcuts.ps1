$desk = [Environment]::GetFolderPath('Desktop')
Get-ChildItem -Path $desk -Filter *.lnk | ForEach-Object {
  $s = (New-Object -ComObject WScript.Shell).CreateShortcut($_.FullName)
  Write-Output ("$($_.Name) -> $($s.TargetPath) | Icon: $($s.IconLocation)")
}