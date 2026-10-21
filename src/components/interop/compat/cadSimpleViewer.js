// src/components/interop/compat/cadSimpleViewer.js
//
// Safe compatibility layer for MLightCAD DXF viewer.
// Provides fallbacks so the application can build and run cleanly on
// environments (such as Android Termux, mobile, or minimal checkouts)
// where heavy native/WASM CAD packages were not installed.

export const AcEdOpenMode = {
  Read: 0,
  Write: 1,
};

export const acedApplyUiTheme = (_theme, _host) => {
  // Theme applicator stub
};

export const acuiRegisterSimpleUiPlugin = async (_pluginManager, _options) => {
  return null;
};

export class AcApDocManager {
  static tryGetInstance() {
    return null;
  }
  static createInstance(_config) {
    return {
      curDocument: null,
      pluginManager: {},
      async openDocument() {
        return false;
      },
      async destroy() {},
      sendStringToExecute() {},
    };
  }
}

export const isAvailable = false;
