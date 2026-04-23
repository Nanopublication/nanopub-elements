import { NanopubClient } from '@nanopub/nanopub-js';
import DOMPurify from 'dompurify';

type Row = Record<string, string>;
type Column = { field: string; label: string; type?: 'text' | 'link' | 'date' };

export class NanopubTable extends HTMLElement {
  static observedAttributes = [
    'query-template',
    'params',
    'endpoint',
    'columns',
    'date-field',
    'sort',
    'limit',
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
    const dateField = this.getAttribute('date-field');
    const sort = this.getAttribute('sort') ?? 'desc';
    const limit = this.hasAttribute('limit')
      ? parseInt(this.getAttribute('limit')!, 10)
      : null;

    let columns: Column[] = [];
    const rawColumns = this.getAttribute('columns');
    if (rawColumns) {
      try {
        columns = JSON.parse(rawColumns);
      } catch {
        // ignore malformed columns
      }
    }

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
    this.#setContent(
      Object.assign(document.createElement('p'), { textContent: 'Loading…' }),
    );

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
      this.#setContent(
        Object.assign(document.createElement('p'), { textContent: 'Failed to load.' }),
      );
      console.error('[nanopub-table]', err);
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
    const rowTemplate = this.querySelector('template');

    // TODO: allow customizing the "no items" message/element via attribute
    if (!items.length) {
      this.#setContent(
        Object.assign(document.createElement('p'), { textContent: 'No items found.' }),
      );
      return;
    }

    // If no columns specified and no template, derive them from the first row's keys
    if (!columns.length && !rowTemplate) {
      columns = Object.keys(items[0]).map(field => ({ field, label: field }));
    }

    this.#setContent(
      rowTemplate
        ? this.#buildTableFromTemplate(items, columns, rowTemplate)
        : this.#buildTable(items, columns),
    );
  }

  #buildTableFromTemplate(
    rows: Row[],
    columns: Column[],
    template: HTMLTemplateElement,
  ): HTMLTableElement {
    const table = document.createElement('table');

    // Header row only if columns were specified; otherwise the author is expected
    // to provide their own header markup outside the element (or accept no header).
    if (columns.length) table.appendChild(this.#buildThead(columns));

    const tbody = document.createElement('tbody');
    for (const row of rows) {
      const clone = template.content.cloneNode(true) as DocumentFragment;
      this.#applyBindings(clone, row);
      tbody.appendChild(clone);
    }
    table.appendChild(tbody);

    return table;
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

  #buildThead(columns: Column[]): HTMLTableSectionElement {
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    for (const col of columns) {
      const th = document.createElement('th');
      th.textContent = col.label;
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    return thead;
  }

  #buildTable(rows: Row[], columns: Column[]): HTMLTableElement {
    const table = document.createElement('table');
    table.appendChild(this.#buildThead(columns));

    const tbody = document.createElement('tbody');
    for (const row of rows) {
      const tr = document.createElement('tr');
      for (const col of columns) {
        const td = document.createElement('td');
        const value = row[col.field] ?? '';
        if (col.type === 'link' && value) {
          const a = document.createElement('a');
          a.href = value;
          a.textContent = value;
          td.appendChild(a);
        } else if (col.type === 'date' && value) {
          const time = document.createElement('time');
          time.dateTime = value;
          time.textContent = value;
          td.appendChild(time);
        } else {
          td.innerHTML = DOMPurify.sanitize(value);
        }
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    return table;
  }
}
