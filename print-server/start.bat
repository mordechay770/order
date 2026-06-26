@echo off
title Print Server — Kitchen Orders
echo.
echo  Starting print server...
echo  Keep this window open while chef dashboard is in use.
echo.
node "%~dp0print-server.js"
pause
