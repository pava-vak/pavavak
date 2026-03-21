@echo off
setlocal

set "ADB=C:\Users\SriKriations\AppData\Local\Android\Sdk\platform-tools\adb.exe"
set "DEVICE=emulator-5554"
set "APK=J:\PaVa-Vak\android-app\app\build\outputs\apk\prod\release\app-prod-release.apk"

if not exist "%ADB%" (
  echo [ERROR] adb not found
  exit /b 1
)

if not exist "%APK%" (
  echo [ERROR] APK not found
  exit /b 1
)

"%ADB%" devices -l
"%ADB%" -s %DEVICE% install -r "%APK%"
if errorlevel 1 (
  echo [WARN] Update install failed. This usually means signature mismatch.
  echo [INFO] Trying fresh install after uninstall...
  "%ADB%" -s %DEVICE% uninstall com.pavavak.app
  "%ADB%" -s %DEVICE% install "%APK%"
  if errorlevel 1 exit /b 1
)
"%ADB%" -s %DEVICE% shell am start -n com.pavavak.app/.MainActivity

endlocal
