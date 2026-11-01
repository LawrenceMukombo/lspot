Add-Type -AssemblyName System.Drawing

$baseDir = "C:\lrm\apps\mobile\android\app\src\main\res"
$densities = @(
    @{ Name = "mipmap-mdpi"; Size = 48 },
    @{ Name = "mipmap-hdpi"; Size = 72 },
    @{ Name = "mipmap-xhdpi"; Size = 96 },
    @{ Name = "mipmap-xxhdpi"; Size = 144 },
    @{ Name = "mipmap-xxxhdpi"; Size = 192 }
)

foreach ($item in $densities) {
    $folderName = $item.Name
    $size = [int]$item.Size
    $folder = Join-Path $baseDir $folderName
    if (-not (Test-Path $folder)) {
        New-Item -ItemType Directory -Path $folder -Force | Out-Null
    }

    # 1. Square / rounded-rect icon
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $cDark = [System.Drawing.ColorTranslator]::FromHtml("#090D16")
    $cAmber = [System.Drawing.ColorTranslator]::FromHtml("#F59E0B")
    $cGold = [System.Drawing.ColorTranslator]::FromHtml("#D97706")

    $bgBrush = New-Object System.Drawing.SolidBrush($cDark)
    $g.FillRectangle($bgBrush, 0, 0, $size, $size)

    # Gold rounded badge
    $pad = [int]($size * 0.08)
    $badgeWidth = [int]($size - (2 * $pad))
    $radius = [int]($size * 0.22)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc($pad, $pad, $radius, $radius, 180, 90)
    $path.AddArc(($pad + $badgeWidth - $radius), $pad, $radius, $radius, 270, 90)
    $path.AddArc(($pad + $badgeWidth - $radius), ($pad + $badgeWidth - $radius), $radius, $radius, 0, 90)
    $path.AddArc($pad, ($pad + $badgeWidth - $radius), $radius, $radius, 90, 90)
    $path.CloseFigure()

    $goldBrush = New-Object System.Drawing.SolidBrush($cAmber)
    $g.FillPath($goldBrush, $path)

    # Inner dark badge
    $innerPad = [int]($size * 0.14)
    $innerWidth = [int]($size - (2 * $innerPad))
    $innerRadius = [int]($size * 0.16)
    $innerPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $innerPath.AddArc($innerPad, $innerPad, $innerRadius, $innerRadius, 180, 90)
    $innerPath.AddArc(($innerPad + $innerWidth - $innerRadius), $innerPad, $innerRadius, $innerRadius, 270, 90)
    $innerPath.AddArc(($innerPad + $innerWidth - $innerRadius), ($innerPad + $innerWidth - $innerRadius), $innerRadius, $innerRadius, 0, 90)
    $innerPath.AddArc($innerPad, ($innerPad + $innerWidth - $innerRadius), $innerRadius, $innerRadius, 90, 90)
    $innerPath.CloseFigure()

    $g.FillPath($bgBrush, $innerPath)

    # Draw Monogram 'LS'
    $fontSize = [float]($size * 0.38)
    $font = New-Object System.Drawing.Font("Arial", $fontSize, [System.Drawing.FontStyle]::Bold)
    $textBrush = New-Object System.Drawing.SolidBrush($cAmber)
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    $drawRectF = [System.Drawing.RectangleF]::new(0, 0, [float]$size, [float]$size)
    $g.DrawString("LS", $font, $textBrush, $drawRectF, $sf)

    $launcherPath = Join-Path $folder "ic_launcher.png"
    $bmp.Save($launcherPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()

    # 2. Round icon
    $bmpRound = New-Object System.Drawing.Bitmap($size, $size)
    $gRound = [System.Drawing.Graphics]::FromImage($bmpRound)
    $gRound.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $gRound.Clear([System.Drawing.Color]::Transparent)

    # Outer circle
    $circlePath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $circlePath.AddEllipse(1, 1, ($size - 2), ($size - 2))
    $gRound.FillPath($bgBrush, $circlePath)

    # Gold circle ring
    $ringPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $ringPath.AddEllipse($pad, $pad, $badgeWidth, $badgeWidth)
    $gRound.FillPath($goldBrush, $ringPath)

    # Inner dark circle
    $innerCircle = New-Object System.Drawing.Drawing2D.GraphicsPath
    $innerCircle.AddEllipse($innerPad, $innerPad, $innerWidth, $innerWidth)
    $gRound.FillPath($bgBrush, $innerCircle)

    # Text
    $gRound.DrawString("LS", $font, $textBrush, $drawRectF, $sf)

    $roundPath = Join-Path $folder "ic_launcher_round.png"
    $bmpRound.Save($roundPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $gRound.Dispose()
    $bmpRound.Dispose()

    Write-Host "Successfully generated icons for $folderName (${size}x${size})"
}
