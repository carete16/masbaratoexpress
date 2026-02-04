@echo off
echo ========================================
echo  SUBIENDO MASBARATO EXPRESS A GITHUB
echo ========================================
echo.

cd /d "%~dp0"

echo [1/5] Verificando estado...
git status
echo.

echo [2/5] Removiendo remote antiguo...
git remote remove origin 2>nul
echo.

echo [3/5] Agregando nuevo remote...
git remote add origin https://github.com/carete16/masbaratoexpress.git
echo.

echo [4/5] Verificando remote...
git remote -v
echo.

echo [5/5] Subiendo codigo a GitHub...
echo NOTA: Si te pide usuario/password, usa tu token de GitHub como password
git push -u origin main
echo.

echo ========================================
echo  COMPLETADO!
echo ========================================
pause
