import { NanopubClient } from '@nanopub/nanopub-js';
import DOMPurify from 'dompurify';

type Row = Record<string, string>;

export class NanopubList extends HTMLElement {
  static observedAttributes = [
    'query-template',
    'params',
    'endpoint',
    'title-field',
    'date-field',
    'link-field',
    'sort',
    'limit',
    'group-by-year',
  ];

  #ac: AbortController | null = null;

  connectedCallback() {
    // Defer so children (e.g. <template>) are parsed before we read them
    setTimeout(() => this.#load());
  }

  attributeChangedCallback() {
    if (this.isConnected) this.#load();
  }

  // Replace non-template children with node, leaving <template> children untouched.
  #setContent(node: Node | null) {
    Array.from(this.childNodes).forEach(child => {
      if (!(child instanceof HTMLTemplateElement)) child.remove();
    });
    if (node) this.appendChild(node);
  }

  disconnectedCallback() {
    this.#ac?.abort();
  }

  async #load() {
    this.#ac?.abort();
    const ac = new AbortController();
    this.#ac = ac;

    const queryTemplateId = this.getAttribute('query-template');
    if (!queryTemplateId) return;

    const endpoint =
      this.getAttribute('endpoint') ?? 'https://query.knowledgepixels.com/';
    const titleField = this.getAttribute('title-field') ?? 'label';
    const dateField = this.getAttribute('date-field');
    const linkField = this.getAttribute('link-field');
    const sort = this.getAttribute('sort') ?? 'desc';
    const limit = this.hasAttribute('limit')
      ? parseInt(this.getAttribute('limit')!, 10)
      : null;
    const groupByYear = this.hasAttribute('group-by-year');

    let params: Record<string, string> = {};
    const rawParams = this.getAttribute('params');
    if (rawParams) {
      try {
        params = JSON.parse(rawParams);
      } catch {
        // ignore malformed params
      }
    }

    // TODO: allow customizing the loading message/element via attribute
    this.#setContent(Object.assign(document.createElement('p'), { textContent: 'Loading…' }));

    const client = new NanopubClient({ endpoints: [endpoint] });
    const rows: Row[] = [];

    try {
      for await (const row of client.runQueryTemplate(queryTemplateId, params)) {
        if (ac.signal.aborted) return;
        rows.push(row);
      }
    } catch (err) {
      if (ac.signal.aborted) return;
      // TODO: allow customizing the error message/element via attribute
      this.#setContent(Object.assign(document.createElement('p'), { textContent: 'Failed to load.' }));
      console.error('[nanopub-list]', err);
      return;
    }

    if (ac.signal.aborted) return;

    if (dateField) {
      rows.sort((a, b) => {
        const da = a[dateField] ? new Date(a[dateField]).getTime() : 0;
        const db = b[dateField] ? new Date(b[dateField]).getTime() : 0;
        return sort === 'asc' ? da - db : db - da;
      });
    }

    const items = limit != null ? rows.slice(0, limit) : rows;

    // Read template after fetch — it's still in the DOM because #setContent preserves it
    const itemTemplate = this.querySelector('template');

    // TODO: allow customizing the "no items" message/element via attribute
    if (!items.length) {
      this.#setContent(Object.assign(document.createElement('p'), { textContent: 'No items found.' }));
      return;
    }

    if (groupByYear && dateField) {
      this.#setContent(null);
      this.#renderGroupedByYear(items, dateField, sort, titleField, linkField, itemTemplate);
    } else {
      this.#setContent(
        itemTemplate
          ? this.#buildListFromTemplate(items, itemTemplate)
          : this.#buildList(items, titleField, dateField, linkField),
      );
    }
  }

  #renderGroupedByYear(
    items: Row[],
    dateField: string,
    sort: string,
    titleField: string,
    linkField: string | null,
    itemTemplate: HTMLTemplateElement | null,
  ) {
    const byYear = new Map<number, Row[]>();
    for (const row of items) {
      const year = row[dateField] ? new Date(row[dateField]).getFullYear() : 0;
      const bucket = byYear.get(year) ?? [];
      bucket.push(row);
      byYear.set(year, bucket);
    }

    const years = [...byYear.keys()].sort((a, b) =>
      sort === 'asc' ? a - b : b - a,
    );

    for (const year of years) {
      const section = document.createElement('section');
      section.dataset.year = String(year);

      const h3 = document.createElement('h3');
      h3.textContent = String(year);
      section.appendChild(h3);

      const list = itemTemplate
        ? this.#buildListFromTemplate(byYear.get(year)!, itemTemplate)
        : this.#buildList(byYear.get(year)!, titleField, dateField, linkField);

      section.appendChild(list);
      this.appendChild(section);
    }
  }

  #buildListFromTemplate(rows: Row[], template: HTMLTemplateElement): HTMLUListElement {
    const ul = document.createElement('ul');
    for (const row of rows) {
      const clone = template.content.cloneNode(true) as DocumentFragment;
      this.#applyBindings(clone, row);
      ul.appendChild(clone);
    }
    return ul;
  }

  // Applies data-bind and data-bind-[attr] to all elements in a fragment.
  // data-bind="Field"      → el.textContent
  // data-bind-href="Field" → el.href  (any attribute name works)
  #applyBindings(root: DocumentFragment, row: Row) {
    root.querySelectorAll('*').forEach(el => {
      for (const [key, field] of Object.entries((el as HTMLElement).dataset)) {
        if (!field || !key.startsWith('bind')) continue;
        const value = row[field] ?? '';
        if (key === 'bind') {
          el.textContent = value;
        } else if (key === 'bindHtml') {
          el.innerHTML = DOMPurify.sanitize(value, { ADD_ATTR: ['target'] });
        } else {
          // bindHref → href, bindAriaLabel → aria-label
          const attr = key
            .slice(4)
            .replace(/([A-Z])/g, '-$1')
            .toLowerCase()
            .replace(/^-/, '');
          el.setAttribute(attr, value);
        }
      }
    });
  }

  #buildList(
    rows: Row[],
    titleField: string,
    dateField: string | null,
    linkField: string | null,
  ): HTMLUListElement {
    const ul = document.createElement('ul');
    for (const row of rows) {
      ul.appendChild(this.#buildItem(row, titleField, dateField, linkField));
    }
    return ul;
  }

  #buildItem(
    row: Row,
    titleField: string,
    dateField: string | null,
    linkField: string | null,
  ): HTMLLIElement {
    const li = document.createElement('li');

    if (dateField && row[dateField]) li.dataset.date = row[dateField];

    const titleText = row[titleField] ?? '';
    if (titleText) {
      const span = document.createElement('span');
      span.innerHTML = DOMPurify.sanitize(titleText);
      li.appendChild(span);
    }

    if (linkField && row[linkField]) {
      const a = document.createElement('a');
      a.href = row[linkField];
      a.textContent = row[linkField];
      li.appendChild(a);
    }

    if (dateField && row[dateField]) {
      const time = document.createElement('time');
      time.dateTime = row[dateField];
      time.textContent = row[dateField];
      li.appendChild(time);
    }

    return li;
  }
}
