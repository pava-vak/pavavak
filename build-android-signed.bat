@echo off
setlocal

set "ROOT_DIR=%~dp0"
set "ANDROID_DIR=%ROOT_DIR%android-app"
set "GRADLE_USER_HOME=%ANDROID_DIR%\.gradle-user-home"
set "ANDROID_USER_HOME=%ANDROID_DIR%\.android-user-home"
set "KEY_PROPS=%ANDROID_DIR%\key.properties"

if not exist "%ANDROID_USER_HOME%" mkdir "%ANDROID_USER_HOME%" >nul 2>nul
if not exist "%GRADLE_USER_HOME%" mkdir "%GRADLE_USER_HOME%" >nul 2>nul

if not exist "%ANDROID_DIR%\gradlew.bat" (
  echo [ERROR] Could not find android-app\gradlew.bat
  exit /b 1
)

if not exist "%KEY_PROPS%" (
  echo [ERROR] Missing signing config: %KEY_PROPS%
  echo.
  echo Create android-app\key.properties from android-app\key.properties.example
  echo and point it to the SAME keystore used to sign the old installed app.
  exit /b 1
)

findstr /R /C:"^storeFile=" /C:"^storePassword=" /C:"^keyAlias=" /C:"^keyPassword=" "%KEY_PROPS%" >nul
if errorlevel 1 (
  echo [ERROR] key.properties is incomplete.
  echo Required keys: storeFile, storePassword, keyAlias, keyPassword
  exit /b 1
)

if "%~1"=="" goto :all
if /I "%~1"=="all" goto :all
if /I "%~1"=="apk" goto :apk
if /I "%~1"=="bundle" goto :bundle
if /I "%~1"=="clean" goto :clean
goto :usage

:all
call :apk || exit /b 1
call :bundle || exit /b 1
goto :done

:apk
echo [BUILD] Signed release APK
call "%ANDROID_DIR%\gradlew.bat" -p "%ANDROID_DIR%" assembleProdRelease || exit /b 1
echo [OK] APK:
echo %ANDROID_DIR%\app\build\outputs\apk\prod\release\app-prod-release.apk
goto :eof

:bundle
echo [BUILD] Signed release AAB
call "%ANDROID_DIR%\gradlew.bat" -p "%ANDROID_DIR%" bundleProdRelease || exit /b 1
echo [OK] AAB:
echo %ANDROID_DIR%\app\build\outputs\bundle\prodRelease\app-prod-release.aab
goto :eof

:clean
echo [BUILD] Clean
call "%ANDROID_DIR%\gradlew.bat" -p "%ANDROID_DIR%" clean || exit /b 1
goto :done

:usage
echo Usage:
echo   build-android-signed.bat all
echo   build-android-signed.bat apk
echo   build-android-signed.bat bundle
echo   build-android-signed.bat clean
exit /b 1

:done
echo [DONE]
endlocal
