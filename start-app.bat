@echo off
title Studio App
chcp 65001 > nul
echo ========================================================
echo               Studio App - Starting Server               
echo ========================================================
echo.
echo Opening http://localhost:9002 in your browser...
echo Please leave this window open while using the application.
echo.

cd /d "%~dp0"

:: Open browser automatically after a short delay
start "" powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 3; Start-Process 'http://localhost:9002'"

:: Run Next.js dev server
npm run dev
