import { NanopubClient } from '@nanopub/nanopub-js';
import { resolveEndpoints } from './endpoints.js';
import { applyBindings, type Row } from './bindings.js';

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
  static observedAttributes = ['uri', 'endpoint', 'link-target'];

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

    const endpoints = resolveEndpoints(this.getAttribute('endpoint'));

    const client = new NanopubClient({ endpoints });

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
    applyBindings(fragment, row);
    this.#setContent(fragment);
    this.#applyLinkTarget();
  }

  // If link-target is set, apply it (and a safe rel) to every rendered link.
  // Runs on the live DOM after render, so it covers built-in links, template
  // links, and anchors parsed from HTML literals alike. <template> contents are
  // inert and not descendants, so the template definition is left untouched.
  #applyLinkTarget() {
    const target = this.getAttribute('link-target');
    if (!target) return;
    this.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(a => {
      a.target = target;
      a.rel = 'noopener noreferrer';
    });
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

    // Multiple values: IRIs joined by spaces, literals by newlines, as data-bind-each splits them.
    const read = (key: string) => {
      const values: any[] = assertion[key] ?? [];
      const joiner = values.every(v => '@id' in v) ? ' ' : '\n';
      return values.map(v => v['@value'] ?? v['@id'] ?? '').filter(Boolean).join(joiner);
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

}
