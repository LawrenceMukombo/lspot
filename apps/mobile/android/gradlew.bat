@echo off
setlocal enabledelayedexpansion

set "APP_HOME=%~dp0"
set "WRAPPER_JAR=%APP_HOME%gradle\wrapper\gradle-wrapper.jar"
set "LOCAL_GRADLE_DIR=%APP_HOME%.gradle-dist\gradle-8.5"
set "LOCAL_GRADLE_BIN=%LOCAL_GRADLE_DIR%\bin\gradle.bat"

REM Ensure Android SDK path is configured in local.properties if present
set "DEFAULT_SDK=%LOCALAPPDATA%\Android\Sdk"
if not exist "%APP_HOME%local.properties" (
    if exist "%DEFAULT_SDK%" (
        set "ESCAPED_SDK=%DEFAULT_SDK:\=\\%"
        echo sdk.dir=!ESCAPED_SDK!> "%APP_HOME%local.properties"
    )
)

REM If local Gradle 8.5 is not yet downloaded, download and extract it automatically
if not exist "%LOCAL_GRADLE_BIN%" (
    echo [LSpot APK Builder] Downloading Gradle 8.5 distribution...
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "$ErrorActionPreference = 'Stop'; " ^
      "$zipPath = Join-Path '%APP_HOME%' 'gradle-8.5-bin.zip'; " ^
      "$destDir = Join-Path '%APP_HOME%' '.gradle-dist'; " ^
      "New-Item -ItemType Directory -Force -Path $destDir | Out-Null; " ^
      "Invoke-WebRequest -Uri 'https://services.gradle.org/distributions/gradle-8.5-bin.zip' -OutFile $zipPath; " ^
      "Expand-Archive -Path $zipPath -DestinationPath $destDir -Force; " ^
      "Remove-Item $zipPath -Force"
)

call "%LOCAL_GRADLE_BIN%" %*
endlocal

