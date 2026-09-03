@echo off
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo 未检测到 Node.js。请先安装 Node.js 22 LTS：https://nodejs.org/
  pause
  exit /b 1
)

for /f "delims=" %%v in ('node -p "process.versions.node.split('.')[0]"') do set NODE_MAJOR=%%v
if %NODE_MAJOR% LSS 22 (
  echo Node.js 版本过低，需要 Node.js 22 或更高版本。
  node -v
  pause
  exit /b 1
)

if not exist node_modules (
  echo 首次运行：正在安装依赖……
  call npm ci
  if errorlevel 1 (
    echo 依赖安装失败，请检查网络后重试。
    pause
    exit /b 1
  )
)

echo Cyber Forge 正在启动：http://localhost:3000
call npm run dev -- --host 0.0.0.0 --port 3000
pause
