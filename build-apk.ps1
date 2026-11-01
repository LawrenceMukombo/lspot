$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Yellow
Write-Host "  THE LSPOT RESTAURANT - ANDROID APK BUILDER (MANYAMA)    " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Yellow

Set-Location "C:\lrm"

# 1. Build web & API workspace and sync offline bundle into Android assets
Write-Host "`n[1/4] Building Web Application & Offline Assets..." -ForegroundColor Cyan
pnpm run build
node apps/mobile/scripts/sync-android.mjs

# 2. Check / Bootstrap Android SDK if not already installed
$AndroidSdkDir = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA "Android\Sdk" }
$PlatformDir = Join-Path $AndroidSdkDir "platforms\android-34"

if (-not (Test-Path $PlatformDir)) {
    Write-Host "`n[2/4] Android SDK Platform 34 not found. Installing Android Command-Line Tools & SDK 34..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Force -Path $AndroidSdkDir | Out-Null
    $CmdToolsZip = Join-Path $env:TEMP "commandlinetools-win.zip"
    $CmdToolsExtract = Join-Path $AndroidSdkDir "cmdline-tools"
    if (-not (Test-Path (Join-Path $CmdToolsExtract "latest\bin\sdkmanager.bat"))) {
        Invoke-WebRequest -Uri "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip" -OutFile $CmdToolsZip
        New-Item -ItemType Directory -Force -Path $CmdToolsExtract | Out-Null
        Expand-Archive -Path $CmdToolsZip -DestinationPath $CmdToolsExtract -Force
        if (Test-Path (Join-Path $CmdToolsExtract "cmdline-tools")) {
            Rename-Item -Path (Join-Path $CmdToolsExtract "cmdline-tools") -NewName "latest" -Force
        }
        Remove-Item $CmdToolsZip -Force -ErrorAction SilentlyContinue
    }
    $SdkManager = Join-Path $CmdToolsExtract "latest\bin\sdkmanager.bat"
    "y`ny`ny`ny`ny`ny`ny`n" | & $SdkManager --sdk_root="$AndroidSdkDir" --licenses | Out-Null
    & $SdkManager --sdk_root="$AndroidSdkDir" "platform-tools" "platforms;android-34" "build-tools;34.0.0"
} else {
    Write-Host "`n[2/4] Android SDK 34 detected at $AndroidSdkDir" -ForegroundColor Green
}

# 3. Write local.properties for Gradle
$AndroidProjectDir = "C:\lrm\apps\mobile\android"
$EscapedSdk = $AndroidSdkDir.Replace("\", "\\")
Set-Content -Path (Join-Path $AndroidProjectDir "local.properties") -Value "sdk.dir=$EscapedSdk" -Encoding ASCII

# 4. Run Gradle wrapper to assemble Debug APK
Write-Host "`n[3/4] Compiling Android APK via Gradle 8.5..." -ForegroundColor Cyan
Set-Location $AndroidProjectDir
& .\gradlew.bat assembleDebug

$BuiltApk = "C:\lrm\apps\mobile\android\app\build\outputs\apk\debug\app-debug.apk"
$DestApk = "C:\lrm\LSpot-Restaurant-POS.apk"

if (Test-Path $BuiltApk) {
    Copy-Item -Path $BuiltApk -Destination $DestApk -Force
    Write-Host "`n==========================================================" -ForegroundColor Green
    Write-Host "  [4/4] APK BUILT SUCCESSFULLY!" -ForegroundColor Green
    Write-Host "  APK File: $DestApk" -ForegroundColor Yellow
    Write-Host "==========================================================" -ForegroundColor Green
}

