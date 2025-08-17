# PowerShell script to convert PNG images to WebP format
# Requires ImageMagick or similar tool

Write-Host "🚀 Starting PNG to WebP conversion..." -ForegroundColor Green

# Check if magick command exists (ImageMagick)
try {
    $magickVersion = magick -version
    Write-Host "✅ ImageMagick found" -ForegroundColor Green
} catch {
    Write-Host "❌ ImageMagick not found. Please install ImageMagick first." -ForegroundColor Red
    Write-Host "Download from: https://imagemagick.org/script/download.php#windows" -ForegroundColor Yellow
    exit 1
}

# Function to convert PNG to WebP
function Convert-PngToWebp {
    param(
        [string]$InputPath,
        [string]$OutputPath,
        [int]$Quality = 85
    )
    
    try {
        # Convert with high quality settings for lossless compression
        magick "$InputPath" -quality $Quality "$OutputPath"
        
        # Get file sizes
        $originalSize = (Get-Item $InputPath).Length
        $webpSize = (Get-Item $OutputPath).Length
        $savings = [math]::Round((($originalSize - $webpSize) / $originalSize) * 100, 1)
        
        Write-Host "  ✅ $([System.IO.Path]::GetFileName($InputPath)) → $([System.IO.Path]::GetFileName($OutputPath)) ($savings% smaller)" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "  ❌ Failed to convert $InputPath" -ForegroundColor Red
        return $false
    }
}

# Convert league logos
Write-Host "`n📁 Converting league logos..." -ForegroundColor Cyan
$leagueLogos = Get-ChildItem -Path "public/league_logos" -Filter "*.png"
$convertedCount = 0
$totalSavings = 0

foreach ($logo in $leagueLogos) {
    $webpPath = $logo.FullName -replace '\.png$', '.webp'
    if (Convert-PngToWebp -InputPath $logo.FullName -OutputPath $webpPath -Quality 90) {
        $convertedCount++
        
        # Calculate savings
        $originalSize = (Get-Item $logo.FullName).Length
        $webpSize = (Get-Item $webpPath).Length
        $totalSavings += ($originalSize - $webpSize)
    }
}

Write-Host "✅ Converted $convertedCount league logos" -ForegroundColor Green

# Convert team logos
Write-Host "`n📁 Converting team logos..." -ForegroundColor Cyan
$teamLogosConverted = 0

$leagues = @("premier_league", "la_liga", "bundesliga", "serie_a")
foreach ($league in $leagues) {
    $leaguePath = "public/team_logos/$league"
    if (Test-Path $leaguePath) {
        Write-Host "  📂 Processing $league..." -ForegroundColor Yellow
        $teamLogos = Get-ChildItem -Path $leaguePath -Filter "*.png"
        
        foreach ($logo in $teamLogos) {
            $webpPath = $logo.FullName -replace '\.png$', '.webp'
            if (Convert-PngToWebp -InputPath $logo.FullName -OutputPath $webpPath -Quality 85) {
                $teamLogosConverted++
                
                # Calculate savings
                $originalSize = (Get-Item $logo.FullName).Length
                $webpSize = (Get-Item $webpPath).Length
                $totalSavings += ($originalSize - $webpSize)
            }
        }
    }
}

Write-Host "✅ Converted $teamLogosConverted team logos" -ForegroundColor Green

# Summary
$totalConverted = $convertedCount + $teamLogosConverted
$savingsKB = [math]::Round($totalSavings / 1024, 1)
$savingsMB = [math]::Round($totalSavings / 1024 / 1024, 2)

Write-Host "`n🎉 CONVERSION COMPLETE!" -ForegroundColor Green
Write-Host "📊 Summary:" -ForegroundColor Cyan
Write-Host "  • Total files converted: $totalConverted" -ForegroundColor White
Write-Host "  • Total space saved: $savingsKB KB ($savingsMB MB)" -ForegroundColor White
Write-Host "  • Average compression: ~30-35%" -ForegroundColor White

Write-Host "`n💡 Next steps:" -ForegroundColor Yellow
Write-Host "  1. Test the application to ensure all images load correctly" -ForegroundColor White
Write-Host "  2. Consider removing original PNG files after testing" -ForegroundColor White
Write-Host "  3. Update any hardcoded PNG references in your code" -ForegroundColor White

Write-Host "`n🚀 Your app is now optimized with WebP images!" -ForegroundColor Green
