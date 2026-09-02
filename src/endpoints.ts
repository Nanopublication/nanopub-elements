import { NanopubClient, NANOPUB_QUERY_URLS } from '@nanopub/nanopub-js';

let endpoints: string[] = [...NANOPUB_QUERY_URLS];
let refreshing: Promise<void> | null = null;

// once per page, in the background, so it never delays a render
function refresh(): void {
  if (refreshing) return;
  refreshing = (async () => {
    const client = new NanopubClient({ endpoints: [...endpoints] });
    try {
      endpoints = await client.refreshEndpoints();
    } catch {
      // keep the bootstrap list
    }
  })();
}

export function resolveEndpoints(override: string | null): string[] {
  // an explicit endpoint attribute opts out of rotation and discovery
  if (override) return [override];
  refresh();
  return [...endpoints];
}
