@echo off
echo Starting Engineering Services App...
cd /d "%~dp0"
docker compose up -d
echo Waiting for services to start...
timeout /t 60
start http://localhost
