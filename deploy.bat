@echo off
REM ============================================================
REM  Deploie Practice OS en prod (Vercel) en une commande.
REM  Usage :  deploy.bat "mon message de commit"
REM  (sans message -> "maj practice os")
REM ============================================================
cd /d "%~dp0"

set "MSG=%~1"
if "%MSG%"=="" set "MSG=maj practice os"

echo.
echo == 1/5  Regeneration de la version bitmap N^&B (os-bw.html) ==
node _bw_inject.cjs

echo.
echo == 2/5  Recuperation des derniers changements ==
git pull origin main
if errorlevel 1 goto :err

echo.
echo == 3/5  Ajout des fichiers du site ==
git add public/

echo.
echo == 4/5  Commit : "%MSG%" ==
git commit -m "%MSG%"

echo.
echo == 5/5  Publication (Vercel deploie automatiquement) ==
git push origin main
if errorlevel 1 goto :err

echo.
echo ============================================================
echo  OK ! Attends ~1 min puis rafraichis :
echo  https://practice-site-five.vercel.app
echo ============================================================
pause
exit /b 0

:err
echo.
echo !!! Une etape a echoue (souvent : "git pull" a ramene des changements).
echo     Relance : git pull origin main   puis   deploy.bat
pause
exit /b 1
