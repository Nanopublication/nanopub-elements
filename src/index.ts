import { NanopubList } from './nanopub-list.js';
import { NanopubTable } from './nanopub-table.js';
export { NanopubClient } from '@nanopub/nanopub-js';

export { NanopubList, NanopubTable };

customElements.define('nanopub-list', NanopubList);
customElements.define('nanopub-table', NanopubTable);
