import { NanopubList } from './nanopub-list.js';
import { NanopubTable } from './nanopub-table.js';
import { NanopubItem } from './nanopub-item.js';
export { NanopubClient } from '@nanopub/nanopub-js';

export { NanopubList, NanopubTable, NanopubItem };

customElements.define('nanopub-list', NanopubList);
customElements.define('nanopub-table', NanopubTable);
customElements.define('nanopub-item', NanopubItem);
