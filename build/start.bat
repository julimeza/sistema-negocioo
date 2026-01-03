@echo off
title Sistema Negocio - Iniciando...


echo  INICIANDO SISTEMA NEGOCIO


REM Iniciar backend
start cmd /k "cd backend && node server.js"

REM Esperar unos segundos para que levante el server
timeout /t 3 >nul

REM Iniciar app WebView
start SistemaNegocio.exe
