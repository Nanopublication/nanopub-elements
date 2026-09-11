import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BOOTSTRAP_ENDPOINTS,
  clientBehaviour,
  clientConfigs,
  resetNanopubJsMock,
} from './nanopub-js-mock.js';
import { flushPendingWork } from './dom.js';

vi.mock('@nanopub/nanopub-js', async () => {
  const mock = await import('./nanopub-js-mock.js');
  return mock.nanopubJsModuleMock();
});

const DISCOVERED_ENDPOINTS = [
  'https://discovered-a.example/np/',
  'https://discovered-b.example/np/',
];

/**
 * Re-evaluates the endpoints module so each test starts from the bootstrap
 * list with discovery not yet attempted.
 *
 * @return the freshly loaded {@code resolveEndpoints} function
 */
async function loadResolveEndpoints() {
  vi.resetModules();
  const module = await import('../src/endpoints.js');
  return module.resolveEndpoints;
}

describe('resolveEndpoints', () => {
  beforeEach(() => {
    resetNanopubJsMock();
  });

  it('returns the bootstrap list when no endpoint is overridden', async () => {
    const resolveEndpoints = await loadResolveEndpoints();

    expect(resolveEndpoints(null)).toEqual(BOOTSTRAP_ENDPOINTS);
  });

  it('returns only the override and skips discovery when one is given', async () => {
    const resolveEndpoints = await loadResolveEndpoints();

    expect(resolveEndpoints('https://chosen.example/np/')).toEqual([
      'https://chosen.example/np/',
    ]);
    await flushPendingWork();
    expect(clientBehaviour.refreshEndpoints).not.toHaveBeenCalled();
  });

  it('discovers endpoints only once no matter how many callers ask', async () => {
    const resolveEndpoints = await loadResolveEndpoints();

    resolveEndpoints(null);
    resolveEndpoints(null);
    resolveEndpoints(null);
    await flushPendingWork();

    expect(clientBehaviour.refreshEndpoints).toHaveBeenCalledTimes(1);
  });

  it('seeds the discovery client with the bootstrap endpoints', async () => {
    const resolveEndpoints = await loadResolveEndpoints();

    resolveEndpoints(null);
    await flushPendingWork();

    expect(clientConfigs[0].endpoints).toEqual(BOOTSTRAP_ENDPOINTS);
  });

  it('serves discovered endpoints once discovery has completed', async () => {
    clientBehaviour.refreshEndpoints.mockResolvedValue(DISCOVERED_ENDPOINTS);
    const resolveEndpoints = await loadResolveEndpoints();

    resolveEndpoints(null);
    await flushPendingWork();

    expect(resolveEndpoints(null)).toEqual(DISCOVERED_ENDPOINTS);
  });

  it('keeps the bootstrap list when discovery fails', async () => {
    clientBehaviour.refreshEndpoints.mockRejectedValue(new Error('offline'));
    const resolveEndpoints = await loadResolveEndpoints();

    resolveEndpoints(null);
    await flushPendingWork();

    expect(resolveEndpoints(null)).toEqual(BOOTSTRAP_ENDPOINTS);
  });

  it('hands out a copy so callers cannot corrupt the shared list', async () => {
    const resolveEndpoints = await loadResolveEndpoints();

    resolveEndpoints(null).push('https://intruder.example/np/');

    expect(resolveEndpoints(null)).toEqual(BOOTSTRAP_ENDPOINTS);
  });
});
