@echo off
rem Publica uma atualizacao sozinho (ver atualizar.ps1). Dois cliques e pronto.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File ".\atualizar.ps1" %*
pause
