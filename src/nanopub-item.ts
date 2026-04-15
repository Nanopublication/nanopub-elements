import { NanopubClient } from '@nanopub/nanopub-js';
import DOMPurify from 'dompurify';

type Row = Record<string, string>;

function formatValue(value: string, format: string | null): string {
  if (!format || !value) return value;
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  if (format === 'date') {
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }
  if (format === 'datetime') {
    return date.toLocaleString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  }
  return value;
}

const PREDICATES: Record<string, string> = {
  label: 'http://www.w3.org/2000/01/rdf-schema#label',
  description: 'http://purl.org/dc/terms/description',
  comment: 'http://www.w3.org/2000/01/rdf-schema#comment',
  name: 'http://xmlns.com/foaf/0.1/name',
  startDate: 'http://schema.org/startDate',
  endDate: 'http://schema.org/endDate',
  created: 'http://purl.org/dc/terms/created',
  creator: 'http://purl.org/dc/terms/creator',
  headline: 'http://schema.org/headline',
  datePublished: 'http://schema.org/datePublished',
};

export class NanopubItem extends HTMLElement {
  static observedAttributes = ['uri', 'endpoint'];

  #ac: AbortController | null = null;

  connectedCallback() {
    setTimeout(() => this.#load());
  }

  attributeChangedCallback() {
    if (this.isConnected) this.#load();
  }

  disconnectedCallback() {
    this.#ac?.abort();
  }

  #setContent(node: Node | null) {
    Array.from(this.childNodes).forEach(child => {
      if (!(child instanceof HTMLTemplateElement)) child.remove();
    });
    if (node) this.appendChild(node);
  }

  async #load() {
    this.#ac?.abort();
    const ac = new AbortController();
    this.#ac = ac;

    const uri = this.getAttribute('uri');
    if (!uri) return;

    const endpoint =
      this.getAttribute('endpoint') ?? 'https://query.knowledgepixels.com/';

    const client = new NanopubClient({ endpoints: [endpoint] });

    let jsonld: Record<string, unknown>[];
    try {
      jsonld = await client.fetchNanopub(uri, 'jsonld');
    } catch (err) {
      if (ac.signal.aborted) return;
      console.error('[nanopub-item]', err);
      return;
    }
    if (ac.signal.aborted) return;

    const row = this.#extractFields(jsonld);
    row.np = uri;

    const template = this.querySelector('template');
    const fragment = template
      ? (template.content.cloneNode(true) as DocumentFragment)
      : this.#defaultFragment();
    this.#applyBindings(fragment, row);
    this.#setContent(fragment);
  }

  #defaultFragment(): DocumentFragment {
    const frag = document.createDocumentFragment();
    const label = document.createElement('p');
    label.dataset.bind = 'label';
    const description = document.createElement('div');
    description.dataset.bindHtml = 'description';
    frag.append(label, description);
    return frag;
  }

  #extractFields(jsonld: any): Row {
    const assertion = jsonld.find((e: any) =>
      e['@id']?.endsWith('/assertion'),
    )?.['@graph']?.[0];
    if (!assertion) return {};

    const row: Row = {};
    if (assertion['@id']) row.subject = assertion['@id'];

    const read = (key: string) => {
      const v = assertion[key]?.[0];
      if (!v) return '';
      return v['@value'] ?? v['@id'] ?? '';
    };

    for (const [short, iri] of Object.entries(PREDICATES)) {
      const v = read(iri);
      if (v) row[short] = v;
    }

    for (const key of Object.keys(assertion)) {
      if (key.startsWith('@')) continue;
      const v = read(key);
      if (v && !(key in row)) row[key] = v;
    }

    return row;
  }

  #applyBindings(root: DocumentFragment, row: Row) {
    root.querySelectorAll('*').forEach(el => {
      const format = (el as HTMLElement).dataset.format ?? null;
      for (const [key, field] of Object.entries((el as HTMLElement).dataset)) {
        if (!field || !key.startsWith('bind')) continue;
        const raw = row[field] ?? '';
        const value = formatValue(raw, format);
        if (key === 'bind') {
          el.textContent = value;
        } else if (key === 'bindHtml') {
          el.innerHTML = DOMPurify.sanitize(value, { ADD_ATTR: ['target'] });
        } else {
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
}
