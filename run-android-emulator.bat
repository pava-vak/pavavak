@echo off
setlocal EnableExtensions

cd /d "%~dp0"

set "ROOT_DIR=%CD%"
set "ANDROID_DIR=%ROOT_DIR%\android-app"
set "SDK_DIR=C:\Users\SriKriations\AppData\Local\Android\Sdk"
set "ADB=%SDK_DIR%\platform-tools\adb.exe"
set "EMULATOR=%SDK_DIR%\emulator\emulator.exe"
set "GRADLE_USER_HOME=%ANDROID_DIR%\.gradle-user-home"
set "ANDROID_USER_HOME=%ANDROID_DIR%\.android-user-home"
set "KOTLIN_DAEMON_DIR=%ANDROID_DIR%\.kotlin-daemon"

set "AVD_NAME=%~2"
if "%AVD_NAME%"=="" set "AVD_NAME=Pixel_6a"

if "%~1"=="" goto usage

if not exist "%ADB%" (
  echo [ERROR] adb not found: %ADB%
  exit /b 1
)

if not exist "%EMULATOR%" (
  echo [ERROR] emulator not found: %EMULATOR%
  exit /b 1
)

if /I "%~1"=="debug" goto run_debug
if /I "%~1"=="signed" goto run_signed
if /I "%~1"=="apk" goto run_apk
if /I "%~1"=="install" goto install_only
if /I "%~1"=="start" goto start_only
goto usage

:usage
echo Usage:
echo   run-android-emulator.bat debug   [AVD_NAME]
echo   run-android-emulator.bat signed  [AVD_NAME]
echo   run-android-emulator.bat apk     [AVD_NAME]
echo   run-android-emulator.bat install [AVD_NAME]
echo   run-android-emulator.bat start   [AVD_NAME]
echo.
echo Modes:
echo   debug   = start emulator, build prodDebug, install/update, launch app
echo   signed  = start emulator, build signed prodRelease, install/update, launch app
echo   apk     = start emulator, build prodRelease, install/update, launch app
echo   install = start emulator, install/update latest available APK, launch app
echo   start   = only start emulator and wait for boot
exit /b 1

:run_debug
call :ensure_emulator || exit /b 1
call :build_debug || exit /b 1
set "APK=%ANDROID_DIR%\app\build\outputs\apk\prod\debug\app-prod-debug.apk"
call :install_and_launch || exit /b 1
goto done

:run_signed
call :ensure_emulator || exit /b 1
call "%ROOT_DIR%\build-android-signed.bat" apk || exit /b 1
set "APK=%ANDROID_DIR%\app\build\outputs\apk\prod\release\app-prod-release.apk"
call :install_and_launch || exit /b 1
goto done

:run_apk
call :ensure_emulator || exit /b 1
call "%ROOT_DIR%\build-android.bat" apk || exit /b 1
set "APK=%ANDROID_DIR%\app\build\outputs\apk\prod\release\app-prod-release.apk"
call :install_and_launch || exit /b 1
goto done

:install_only
call :ensure_emulator || exit /b 1
if exist "%ANDROID_DIR%\app\build\outputs\apk\prod\release\app-prod-release.apk" (
  set "APK=%ANDROID_DIR%\app\build\outputs\apk\prod\release\app-prod-release.apk"
) else (
  set "APK=%ANDROID_DIR%\app\build\outputs\apk\prod\debug\app-prod-debug.apk"
)
if not exist "%APK%" (
  echo [ERROR] No APK found to install.
  exit /b 1
)
call :install_and_launch || exit /b 1
goto done

:start_only
call :ensure_emulator || exit /b 1
goto done

:build_debug
call "%ROOT_DIR%\build-android.bat" debug || exit /b 1
goto :eof

:ensure_emulator
echo [INFO] Checking emulator...
"%ADB%" start-server >nul 2>nul
set "DEVICE="
set "BOOTED="
set "ADB_LIST_FILE=%TEMP%\pavavak_adb_devices.txt"
"%ADB%" devices > "%ADB_LIST_FILE%"
for /f "tokens=1,2" %%A in ('type "%ADB_LIST_FILE%" ^| findstr /B "emulator-"') do (
  if "%%B"=="device" set "DEVICE=%%A"
)
if defined DEVICE goto device_found
echo [INFO] Starting AVD: %AVD_NAME%
start "" "%EMULATOR%" -avd "%AVD_NAME%"
echo [INFO] Waiting for emulator device...
"%ADB%" wait-for-device >nul 2>nul
:device_found
"%ADB%" devices > "%ADB_LIST_FILE%"
for /f "tokens=1,2" %%A in ('type "%ADB_LIST_FILE%" ^| findstr /B "emulator-"') do (
  if "%%B"=="device" set "DEVICE=%%A"
)
del "%ADB_LIST_FILE%" >nul 2>nul
if "%DEVICE%"=="" (
  echo [ERROR] Emulator device not found.
  exit /b 1
)
echo [INFO] Using device: %DEVICE%
echo [INFO] Waiting for Android boot...
:boot_wait
for /f "delims=" %%B in ('"%ADB%" -s %DEVICE% shell getprop sys.boot_completed 2^>nul') do set "BOOTED=%%B"
if not "%BOOTED%"=="1" (
  timeout /t 3 /nobreak >nul
  goto boot_wait
)
timeout /t 2 /nobreak >nul
goto :eof

:install_and_launch
if not exist "%APK%" (
  echo [ERROR] APK not found: %APK%
  exit /b 1
)
echo [INFO] Installing APK: %APK%
"%ADB%" -s %DEVICE% install -r "%APK%"
if errorlevel 1 (
  echo [WARN] Update install failed. Trying reinstall after uninstall...
  "%ADB%" -s %DEVICE% uninstall com.pavavak.app >nul 2>nul
  "%ADB%" -s %DEVICE% install "%APK%"
  if errorlevel 1 exit /b 1
)
echo [INFO] Launching app...
"%ADB%" -s %DEVICE% shell am start -n com.pavavak.app/.MainActivity
goto :eof

:done
echo [DONE]
endlocal
