@echo off
title Sistema Negocio - Iniciando...
echo =============================
echo   INICIANDO SISTEMA NEGOCIO
echo =============================

rem Iniciar backend
cd backend
start "" node server.js

rem Esperar backend
timeout /t 2 >nul

rem Volver
cd ..

rem Iniciar app escritorio
start "" app\bin\Debug\net7.0-windows\SistemaNegocio.exe

exit
