import { vi, type Mock } from 'vitest';

export type QueryRow = Record<string, string>;

export const BOOTSTRAP_ENDPOINTS = ['https://bootstrap.example/np/'];

type NanopubJsMockState = {
  fetchNanopub: Mock;
  runQueryTemplate: Mock;
  refreshEndpoints: Mock;
  configs: { endpoints: string[] }[];
};

const globalWithMockState = globalThis as typeof globalThis & {
  nanopubJsMockState?: NanopubJsMockState;
};

const state: NanopubJsMockState = (globalWithMockState.nanopubJsMockState ??= {
  fetchNanopub: vi.fn(),
  runQueryTemplate: vi.fn(),
  refreshEndpoints: vi.fn(),
  configs: [],
});

export const clientBehaviour = state;
export const clientConfigs = state.configs;

/**
 * Stand-in for the real {@code NanopubClient} that records how it was
 * configured and delegates every call to {@link clientBehaviour}, so tests can
 * script responses without touching the network.
 *
 * <p>Its state is held on the global object so that it survives the module
 * registry resets used to re-evaluate modules under test.
 */
export class NanopubClientMock {
  /**
   * @param config the endpoint configuration the component built
   */
  constructor(config: { endpoints: string[] }) {
    state.configs.push(config);
  }

  /**
   * @param uri the nanopublication URI to fetch
   * @param format the requested serialization
   * @return the scripted nanopublication payload
   */
  fetchNanopub(uri: string, format?: string): unknown {
    return state.fetchNanopub(uri, format);
  }

  /**
   * @param queryId the query template identifier
   * @param params the query template parameters
   * @return an async iterable of scripted result rows
   */
  runQueryTemplate(queryId: string, params?: QueryRow): AsyncIterable<QueryRow> {
    return state.runQueryTemplate(queryId, params);
  }

  /**
   * @return the scripted list of discovered query endpoints
   */
  refreshEndpoints(): Promise<string[]> {
    return state.refreshEndpoints();
  }
}

/**
 * Clears every recorded call and restores the default behaviour, in which
 * endpoint discovery resolves back to the bootstrap list.
 */
export function resetNanopubJsMock(): void {
  state.configs.length = 0;
  state.fetchNanopub.mockReset();
  state.runQueryTemplate.mockReset();
  state.refreshEndpoints.mockReset().mockResolvedValue([...BOOTSTRAP_ENDPOINTS]);
}

/**
 * Scripts the query template call to stream the given rows.
 *
 * @param rows the rows to yield, in the order the client should emit them
 */
export function respondWithRows(rows: QueryRow[]): void {
  state.runQueryTemplate.mockImplementation(async function* () {
    for (const row of rows) yield row;
  });
}

/**
 * Scripts the query template call to fail while it is being iterated.
 *
 * @param error the error to raise from the stream
 */
export function respondWithQueryFailure(error: Error): void {
  state.runQueryTemplate.mockImplementation(async function* (): AsyncGenerator<
    QueryRow,
    void,
    unknown
  > {
    throw error;
  });
}

/**
 * The module shape that replaces {@code @nanopub/nanopub-js} in tests.
 *
 * @return the mocked exports the components import
 */
export function nanopubJsModuleMock(): Record<string, unknown> {
  return {
    NanopubClient: NanopubClientMock,
    NANOPUB_QUERY_URLS: BOOTSTRAP_ENDPOINTS,
  };
}
