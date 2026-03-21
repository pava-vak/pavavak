@echo off
setlocal

cd /d "%~dp0"

set "ROOT_DIR=%CD%"
set "ANDROID_DIR=%ROOT_DIR%\android-app"
set "GRADLE_USER_HOME=%ANDROID_DIR%\.gradle-user-home"
set "ANDROID_USER_HOME=%ANDROID_DIR%\.android-user-home"

if "%~1"=="" goto usage

if not exist "%ANDROID_DIR%\gradlew.bat" (
  echo [ERROR] Could not find android-app\gradlew.bat
  exit /b 1
)

if /I "%~1"=="apk" goto apk
if /I "%~1"=="bundle" goto bundle
if /I "%~1"=="all" goto all
if /I "%~1"=="debug" goto debug
if /I "%~1"=="clean" goto clean

:usage
echo Usage:
echo   build-android.bat apk
echo   build-android.bat bundle
echo   build-android.bat all
echo   build-android.bat debug
echo   build-android.bat clean
exit /b 1

:apk
cd /d "%ANDROID_DIR%"
call .\gradlew.bat assembleProdRelease
goto outputs

:bundle
cd /d "%ANDROID_DIR%"
call .\gradlew.bat bundleProdRelease
goto outputs

:all
cd /d "%ANDROID_DIR%"
call .\gradlew.bat assembleProdRelease bundleProdRelease
goto outputs

:debug
cd /d "%ANDROID_DIR%"
call .\gradlew.bat assembleProdDebug
goto outputs

:clean
cd /d "%ANDROID_DIR%"
call .\gradlew.bat clean
goto :eof

:outputs
echo.
echo Expected output paths:
echo   APK    : %ANDROID_DIR%\app\build\outputs\apk\prod\release\app-prod-release.apk
echo   AAB    : %ANDROID_DIR%\app\build\outputs\bundle\prodRelease\app-prod-release.aab
echo   DEBUG  : %ANDROID_DIR%\app\build\outputs\apk\prod\debug\app-prod-debug.apk

endlocal
