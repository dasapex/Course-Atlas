@echo off
chcp 65001 >nul 2>&1
setlocal EnableExtensions

title Course Atlas Launcher

set "PROJECT_DIR=%~dp0"
set "LOCAL_URL=http://127.0.0.1:8000/"

cd /d "%PROJECT_DIR%"

echo.
echo Course Atlas
echo ========================================
echo.

where python >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or is not in PATH.
    echo Install Python from https://www.python.org/
    pause
    exit /b 1
)

where hugo >nul 2>&1
if errorlevel 1 (
    echo ERROR: Hugo is not installed or is not in PATH.
    echo Install Hugo Extended using:
    echo winget install Hugo.Hugo.Extended
    pause
    exit /b 1
)

if not exist "source-data\BSCE-FEUIT-CurriculumTree.xlsx" (
    echo ERROR: Curriculum workbook not found.
    echo Expected:
    echo source-data\BSCE-FEUIT-CurriculumTree.xlsx
    pause
    exit /b 1
)

echo [1/3] Extracting curriculum data...
python scripts\extract_curriculum.py

if errorlevel 1 (
    echo.
    echo ERROR: Curriculum extraction failed.
    pause
    exit /b 1
)

echo [2/3] Building website...
hugo --gc --minify --baseURL "%LOCAL_URL%"

if errorlevel 1 (
    echo.
    echo ERROR: Hugo build failed.
    pause
    exit /b 1
)

echo [3/3] Starting local website...

start "Course Atlas Local Server" /min cmd /k ^
    python -m http.server 8000 --bind 127.0.0.1 --directory public

timeout /t 2 /nobreak >nul

start "" "%LOCAL_URL%"

echo.
echo Course Atlas opened at:
echo %LOCAL_URL%
echo.
echo Close the "Course Atlas Local Server" window to stop it.

exit /b 0
