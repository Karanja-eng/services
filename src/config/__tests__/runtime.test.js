/**
 * Unit tests for the environment-aware backend configuration.
 *
 * These protect the specific defect they were written for: the workbench used to
 * hardcode `http://127.0.0.1:8001`, which cannot work when the browser runs on a
 * different device from the backend.
 */

import {
  CAD_IFC_PREFIX,
  DEFAULT_BACKEND_PORT,
  backendStartCommands,
  resolveApiOrigin,
} from '../runtime';

describe('resolveApiOrigin', () => {
  test('an explicit REACT_APP_API_BASE always wins', () => {
    const result = resolveApiOrigin({
      explicit: 'https://api.example.com/',
      location: { protocol: 'https:', hostname: 'app.example.com', port: '443' },
    });
    expect(result.origin).toBe('https://api.example.com');
    expect(result.source).toBe('env');
  });

  test('a page served by the backend uses its own origin', () => {
    const result = resolveApiOrigin({
      explicit: '',
      location: { protocol: 'http:', hostname: '127.0.0.1', port: DEFAULT_BACKEND_PORT },
    });
    expect(result.origin).toBe(`http://127.0.0.1:${DEFAULT_BACKEND_PORT}`);
    expect(result.source).toBe('same-origin');
    expect(result.sameOrigin).toBe(true);
  });

  test('a phone opening the dev server reaches the backend on the same host', () => {
    // The bug: this used to resolve to 127.0.0.1, i.e. the phone itself.
    const result = resolveApiOrigin({
      explicit: '',
      location: { protocol: 'http:', hostname: '192.168.1.20', port: '3000' },
    });
    expect(result.origin).toBe('http://192.168.1.20:8001');
    expect(result.source).toBe('page-host');
    expect(result.origin).not.toContain('127.0.0.1');
    expect(result.detail).toContain('0.0.0.0');
  });

  test('localhost keeps localhost but changes the port', () => {
    const result = resolveApiOrigin({
      explicit: '',
      location: { protocol: 'http:', hostname: 'localhost', port: '3000' },
    });
    expect(result.origin).toBe('http://localhost:8001');
    expect(result.source).toBe('loopback');
  });

  test('https pages derive an https backend origin', () => {
    const result = resolveApiOrigin({
      explicit: '',
      location: { protocol: 'https:', hostname: 'fundi.example.com', port: '' },
    });
    expect(result.origin).toBe('https://fundi.example.com:8001');
  });

  test('a non-default port can be requested', () => {
    const result = resolveApiOrigin({
      explicit: '',
      location: { protocol: 'http:', hostname: 'localhost', port: '3000' },
      port: '9000',
    });
    expect(result.origin).toBe('http://localhost:9000');
  });

  test('with no location it falls back to the documented loopback default', () => {
    const result = resolveApiOrigin({ explicit: '', location: {} });
    expect(result.origin).toBe('http://127.0.0.1:8001');
    expect(result.source).toBe('fallback');
  });
});

describe('backendStartCommands', () => {
  test('quotes the health URL the API client actually uses', () => {
    const commands = backendStartCommands('http://192.168.1.20:8001');
    expect(commands.health).toBe(`http://192.168.1.20:8001${CAD_IFC_PREFIX}/health`);
    expect(commands.sameDevice).toContain('src.Backend.cad_ifc.standalone');
    expect(commands.lanAccess).toContain('0.0.0.0');
  });
});
