@echo off
rem Abre o publicar-github.ps1 sem precisar mudar a politica de execucao do PowerShell.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File ".\publicar-github.ps1" %*
pause
