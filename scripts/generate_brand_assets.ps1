<#
  Generates the source art used by @capacitor/assets for the WAEC Field APK.

  Brand: WAEC gold crest on the product's deep-navy / primary-blue palette.
  Run from the repository root:
      powershell -File scripts/generate_brand_assets.ps1
#>
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$logoPath = Join-Path $root 'public/images/waec-logo.png'
$outDir = Join-Path $root 'assets'
New-Item -ItemType Directory -Path $outDir -Force | Out-Null

$navyTop    = [System.Drawing.Color]::FromArgb(255, 27, 42, 85)   # #1B2A55
$navyBottom = [System.Drawing.Color]::FromArgb(255, 7, 9, 19)     # #070913
$brandBlue  = [System.Drawing.Color]::FromArgb(255, 59, 87, 240)  # #3b57f0
$gold       = [System.Drawing.Color]::FromArgb(255, 242, 201, 76) # #F2C94C
$white      = [System.Drawing.Color]::FromArgb(255, 255, 255, 255)

function New-Bitmap([int]$w, [int]$h) {
    $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    return @{ Bitmap = $bmp; Graphics = $g }
}

function Save-Png($bmp, [string]$path) {
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
}

function Draw-Glow($g, [int]$cx, [int]$cy, [int]$radius) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddEllipse(($cx - $radius), ($cy - $radius), ($radius * 2), ($radius * 2))
    $brush = New-Object System.Drawing.Drawing2D.PathGradientBrush($path)
    $brush.CenterPoint = New-Object System.Drawing.PointF($cx, $cy)
    $brush.CenterColor = [System.Drawing.Color]::FromArgb(70, $brandBlue.R, $brandBlue.G, $brandBlue.B)
    $brush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, $brandBlue.R, $brandBlue.G, $brandBlue.B))
    $g.FillPath($brush, $path)
    $brush.Dispose(); $path.Dispose()
}

function Draw-Tracked($g, [string]$text, [string]$fontName, [float]$size, [bool]$bold, [int]$spacing,
                      [int]$centerX, [int]$y, [System.Drawing.Color]$color) {
    $style = [System.Drawing.FontStyle]::Regular
    if ($bold) { $style = [System.Drawing.FontStyle]::Bold }
    $font = New-Object System.Drawing.Font($fontName, $size, $style, [System.Drawing.GraphicsUnit]::Pixel)
    $brush = New-Object System.Drawing.SolidBrush($color)
    $widths = @()
    $total = 0
    foreach ($ch in $text.ToCharArray()) {
        $w = [int][math]::Ceiling($g.MeasureString([string]$ch, $font).Width)
        $widths += $w
        $total += $w + $spacing
    }
    $total -= $spacing
    $x = [int]($centerX - ($total / 2))
    for ($i = 0; $i -lt $text.Length; $i++) {
        $g.DrawString([string]$text[$i], $font, $brush, $x, $y)
        $x += $widths[$i] + $spacing
    }
    $font.Dispose(); $brush.Dispose()
}

# --- Logo crop: the source is transparent with a small margin -----------------
$logo = [System.Drawing.Bitmap]::FromFile($logoPath)
$minX = 9999; $minY = 9999; $maxX = -1; $maxY = -1
for ($y = 0; $y -lt $logo.Height; $y++) {
    for ($x = 0; $x -lt $logo.Width; $x++) {
        if ($logo.GetPixel($x, $y).A -gt 24) {
            if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y }
        }
    }
}
$crop = New-Object System.Drawing.Rectangle($minX, $minY, ($maxX - $minX + 1), ($maxY - $minY + 1))

function Draw-Logo($g, [int]$cx, [int]$cy, [int]$height, $logo, $crop) {
    $w = [int]($height * ($crop.Width / [float]$crop.Height))
    $rect = New-Object System.Drawing.Rectangle(($cx - [int]($w / 2)), ($cy - [int]($height / 2)), $w, $height)
    $g.DrawImage($logo, $rect, $crop, [System.Drawing.GraphicsUnit]::Pixel)
}

# --- Icon background: navy gradient + restrained blue glow --------------------
$iconBg = New-Bitmap 1024 1024
$g = $iconBg.Graphics
$grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.PointF(0, 0)),
    (New-Object System.Drawing.PointF(0, 1024)),
    $navyTop, $navyBottom)
$g.FillRectangle($grad, 0, 0, 1024, 1024)
Draw-Glow $g 512 500 430
Save-Png $iconBg.Bitmap (Join-Path $outDir 'icon-background.png')
$g.Dispose(); $grad.Dispose(); $iconBg.Bitmap.Dispose()

# --- Icon foreground: crest only, inside the adaptive safe zone ---------------
$iconFg = New-Bitmap 1024 1024
$g = $iconFg.Graphics
Draw-Logo $g 512 512 600 $logo $crop
Save-Png $iconFg.Bitmap (Join-Path $outDir 'icon-foreground.png')
$g.Dispose(); $iconFg.Bitmap.Dispose()

# --- Legacy composite icon ---------------------------------------------------
$iconOnly = New-Bitmap 1024 1024
$g = $iconOnly.Graphics
$grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.PointF(0, 0)),
    (New-Object System.Drawing.PointF(0, 1024)),
    $navyTop, $navyBottom)
$g.FillRectangle($grad, 0, 0, 1024, 1024)
Draw-Glow $g 512 500 430
Draw-Logo $g 512 512 600 $logo $crop
Save-Png $iconOnly.Bitmap (Join-Path $outDir 'icon-only.png')
$g.Dispose(); $grad.Dispose(); $iconOnly.Bitmap.Dispose()

# --- Splash: brand mark + wordmark, centred and safe --------------------------
$splash = New-Bitmap 2732 2732
$g = $splash.Graphics
$grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.PointF(0, 0)),
    (New-Object System.Drawing.PointF(0, 2732)),
    $navyTop, $navyBottom)
$g.FillRectangle($grad, 0, 0, 2732, 2732)
Draw-Glow $g 1366 1150 900
Draw-Logo $g 1366 1050 560 $logo $crop
Draw-Tracked $g 'WAEC FIELD' 'Arial' 158 $true 12 1366 1510 $white
$pen = New-Object System.Drawing.Pen($gold, 5)
$g.DrawLine($pen, 1066, 1720, 1666, 1720)
Draw-Tracked $g 'MONITORING OPERATIONS' 'Arial' 62 $false 9 1366 1770 $gold
Save-Png $splash.Bitmap (Join-Path $outDir 'splash.png')
$g.Dispose(); $grad.Dispose(); $pen.Dispose(); $splash.Bitmap.Dispose()

# --- Web / PWA icons: same brand, honest safe-zone padding --------------------
$webSource = [System.Drawing.Bitmap]::FromFile((Join-Path $outDir 'icon-only.png'))
function Resize-Icon([int]$size, [string]$path) {
    $r = New-Bitmap $size $size
    $g = $r.Graphics
    $g.DrawImage($webSource, 0, 0, $size, $size)
    Save-Png $r.Bitmap $path
    $g.Dispose(); $r.Bitmap.Dispose()
}

Resize-Icon 512 (Join-Path $root 'public/icon.png')
Resize-Icon 192 (Join-Path $root 'public/icon-192.png')
Resize-Icon 180 (Join-Path $root 'public/apple-icon.png')
Resize-Icon 512 (Join-Path $root 'app/icon.png')
Resize-Icon 180 (Join-Path $root 'app/apple-icon.png')

# Browser tab favicon derived from the same crest.
$fav = New-Bitmap 48 48
$g = $fav.Graphics
$g.DrawImage($webSource, 0, 0, 48, 48)
$hicon = $fav.Bitmap.GetHicon()
$ico = [System.Drawing.Icon]::FromHandle($hicon)
$stream = [System.IO.File]::Create((Join-Path $root 'public/favicon.ico'))
$ico.Save($stream)
$stream.Dispose(); $ico.Dispose(); $g.Dispose(); $fav.Bitmap.Dispose()
$webSource.Dispose()

$logo.Dispose()
Write-Output 'Generated assets/icon-background.png, icon-foreground.png, icon-only.png, splash.png'
Write-Output 'Updated public/icon.png, public/icon-192.png, public/apple-icon.png and app copies'
