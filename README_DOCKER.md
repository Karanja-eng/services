# Running Services App with Docker

## Prerequisites
- Docker Desktop installed and running.

## files
- `Dockerfile` (Frontend)
- `src/Backend/Dockerfile` (Backend)
- `docker-compose.yml` (Orchestration)

## Easy Start (Windows)
I have created a `start_app.bat` file for you.
1.  Go to the project folder.
2.  Right-click `start_app.bat` -> **Send to** -> **Desktop (create shortcut)**.
3.  Now you can double-click the shortcut on your desktop to start the app.

## Manual Start
Open a terminal in this folder and run:
```bash
docker compose up -d --build
```
Access the app at: [http://localhost](http://localhost)

## Stopping the App
```bash
docker compose down
```
