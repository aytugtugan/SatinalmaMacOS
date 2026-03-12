param()
Add-Type -AssemblyName System.Drawing

$srcPath = "c:\Users\acemoglu\Desktop\SatinAlma\masaustu\assets\logo.jpg"
$icoPath = "c:\Users\acemoglu\Desktop\SatinAlma\masaustu\assets\icon.ico"
$pngPath = "c:\Users\acemoglu\Desktop\SatinAlma\masaustu\assets\icon_256.png"

# Read and resize to 256x256 PNG
$srcBytes = [System.IO.File]::ReadAllBytes($srcPath)
$msIn = New-Object System.IO.MemoryStream(,$srcBytes)
$src = [System.Drawing.Image]::FromStream($msIn)

$bmp = New-Object System.Drawing.Bitmap(256, 256)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($src, 0, 0, 256, 256)

$msOut = New-Object System.IO.MemoryStream
$bmp.Save($msOut, [System.Drawing.Imaging.ImageFormat]::Png)
$pngBytes = $msOut.ToArray()

$g.Dispose(); $bmp.Dispose(); $src.Dispose(); $msIn.Dispose()

# Write PNG (for reference)
[System.IO.File]::WriteAllBytes($pngPath, $pngBytes)
Write-Host ("PNG: " + $pngBytes.Length + " bytes")

# Build ICO wrapping the PNG (Windows Vista+ ICO-with-embedded-PNG format)
# ICO Header: reserved(2) + type=1(2) + count=1(2) = 6 bytes
$header = [byte[]]@(0x00,0x00, 0x01,0x00, 0x01,0x00)

# Directory entry: width=0(=256)(1) + height=0(=256)(1) + colors=0(1) + reserved=0(1) + planes=1(2) + bits=32(2) + datasize(4) + offset=22(4)
$dataSize = $pngBytes.Length
$dir = New-Object byte[] 16
$dir[0] = 0x00  # width (0=256)
$dir[1] = 0x00  # height (0=256)
$dir[2] = 0x00  # colorCount
$dir[3] = 0x00  # reserved
$dir[4] = 0x01; $dir[5] = 0x00  # planes = 1
$dir[6] = 0x20; $dir[7] = 0x00  # bitCount = 32
# data size (little-endian 4 bytes)
$dir[8]  = [byte]($dataSize -band 0xFF)
$dir[9]  = [byte](($dataSize -shr 8) -band 0xFF)
$dir[10] = [byte](($dataSize -shr 16) -band 0xFF)
$dir[11] = [byte](($dataSize -shr 24) -band 0xFF)
# offset = 22 (6 header + 16 dir entry)
$dir[12] = 0x16; $dir[13] = 0x00; $dir[14] = 0x00; $dir[15] = 0x00

$icoBytes = $header + $dir + $pngBytes
[System.IO.File]::WriteAllBytes($icoPath, $icoBytes)
Write-Host ("ICO: " + $icoBytes.Length + " bytes -> " + $icoPath)
