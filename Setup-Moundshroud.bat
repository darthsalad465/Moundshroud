@echo off
rem Double-click to set up Moundshroud. It runs setup.ps1 (no admin rights needed).
title Moundshroud setup
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"
if errorlevel 1 (
  echo.
  echo Setup stopped because of an error. Take a photo or screenshot of this window and send it to whoever gave you Moundshroud.
  pause
)
