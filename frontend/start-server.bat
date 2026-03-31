@echo off
echo ========================================
echo   DEADLIST - EVE Frontier Bounty Board
echo ========================================
echo.
echo Starting local server on http://localhost:8000
echo.
echo To access in EVE Frontier:
echo   1. Open the in-game dApp browser
echo   2. Navigate to: http://localhost:8000
echo.
echo Press Ctrl+C to stop the server
echo.
python -m http.server 8000
