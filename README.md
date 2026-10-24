# Fundi Studio

Engineering software (structural RC/steel, surveying, quantity surveying, CAD/BIM).
Bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Running the app and the CAD/BIM backend

The React app and the FastAPI backend are separate processes. The frontend resolves
the backend from its own runtime configuration (see `src/config/runtime.js`):

1. `REACT_APP_API_BASE`, if set — always wins;
2. the page's own origin when it is served on port 8001;
3. the page's own hostname on port 8001 (so a phone that opened the dev server via
   the machine's LAN IP reaches the backend on that machine);
4. `http://127.0.0.1:8001` as the last resort.

`127.0.0.1` is resolved by the *browser*, so it only works when the browser and the
backend are on the same device.

```bash
# 1. frontend (development)
npm install            # also copies the CAD/BIM worker + WASM assets into public/
npm start              # http://localhost:3000  →  /interop/cad-bim

# 2.a backend, same device (loopback only, the safe default)
.venv-ifc\Scripts\python.exe -m src.Backend.cad_ifc.standalone --host 127.0.0.1 --port 8001

# 2.b backend for a phone/tablet on the same network (exposes the API to the LAN)
.venv-ifc\Scripts\python.exe -m src.Backend.cad_ifc.standalone --host 0.0.0.0 --port 8001
#     then open http://<this-machine-ip>:3000/interop/cad-bim on the phone

# 2.c full backend (all engineering routers; must start from src/Backend because it
#     uses top-level imports). FUNDI_HOST / FUNDI_PORT override the defaults.
cd src/Backend && ..\..\.venv-ifc\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8001
```

Health check: `http://127.0.0.1:8001/api/cad-ifc/health`.
On Android/Termux, `python -m src.Backend.cad_ifc.standalone` works the same way with
`.venv-ifc/bin/python`.

Building: `npm run build` (raises the heap and skips source maps because the
MLightCAD/That Open bundles exceed Node's default build memory; use
`GENERATE_SOURCEMAP=true` when source maps are needed, or `npm run build:cra` for the
unmodified CRA build).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
