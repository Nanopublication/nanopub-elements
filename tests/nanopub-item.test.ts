import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clientBehaviour,
  clientConfigs,
  resetNanopubJsMock,
} from './nanopub-js-mock.js';
import { mount, unmountAll } from './dom.js';

vi.mock('@nanopub/nanopub-js', async () => {
  const mock = await import('./nanopub-js-mock.js');
  return mock.nanopubJsModuleMock();
});

await import('../src/index.js');

const NANOPUB_URI = 'https://w3id.org/np/RAexample';
const SUBJECT_URI = 'https://example.org/thing';
const UNMAPPED_PREDICATE = 'https://example.org/vocab#topic';

/**
 * Wraps assertion triples in the head/assertion structure the component
 * expects from a JSON-LD nanopublication.
 *
 * @param assertion the node making up the assertion graph
 * @return the JSON-LD payload the client should return
 */
function nanopubJsonld(assertion: Record<string, unknown>) {
  return [
    { '@id': `${NANOPUB_URI}/Head`, '@graph': [{ '@id': NANOPUB_URI }] },
    { '@id': `${NANOPUB_URI}/assertion`, '@graph': [assertion] },
  ];
}

/**
 * @param overrides extra or replacement predicates for the assertion node
 * @return an assertion node carrying a label and a description
 */
function assertionWith(overrides: Record<string, unknown> = {}) {
  return {
    '@id': SUBJECT_URI,
    'http://www.w3.org/2000/01/rdf-schema#label': [{ '@value': 'A label' }],
    'http://purl.org/dc/terms/description': [{ '@value': '<p>A description</p>' }],
    ...overrides,
  };
}

/**
 * Scripts the client to return the given assertion for any fetched nanopub.
 *
 * @param assertion the assertion node to serve
 */
function respondWithAssertion(assertion: Record<string, unknown>): void {
  clientBehaviour.fetchNanopub.mockResolvedValue(nanopubJsonld(assertion));
}

describe('nanopub-item', () => {
  beforeEach(() => {
    resetNanopubJsMock();
    respondWithAssertion(assertionWith());
  });

  afterEach(() => {
    unmountAll();
    vi.restoreAllMocks();
  });

  describe('default rendering', () => {
    it('renders the label as text and the description as markup', async () => {
      const item = await mount(`<nanopub-item uri="${NANOPUB_URI}"></nanopub-item>`);

      expect(item.querySelector('p')?.textContent).toBe('A label');
      expect(item.querySelector('div')?.innerHTML).toBe('<p>A description</p>');
    });

    it('requests the nanopub as JSON-LD', async () => {
      await mount(`<nanopub-item uri="${NANOPUB_URI}"></nanopub-item>`);

      expect(clientBehaviour.fetchNanopub).toHaveBeenCalledWith(
        NANOPUB_URI,
        'jsonld',
      );
    });

    it('renders nothing when no uri is given', async () => {
      const item = await mount('<nanopub-item></nanopub-item>');

      expect(item.children).toHaveLength(0);
      expect(clientBehaviour.fetchNanopub).not.toHaveBeenCalled();
    });
  });

  describe('field extraction', () => {
    /**
     * @param binding the field name to bind into the template
     * @return the text the component rendered for that field
     */
    async function renderedValueOf(binding: string): Promise<string> {
      const item = await mount(`
        <nanopub-item uri="${NANOPUB_URI}">
          <template><span data-bind="${binding}"></span></template>
        </nanopub-item>
      `);
      return item.querySelector('span')?.textContent ?? '';
    }

    it('exposes the nanopub uri as np', async () => {
      expect(await renderedValueOf('np')).toBe(NANOPUB_URI);
    });

    it('exposes the assertion subject', async () => {
      expect(await renderedValueOf('subject')).toBe(SUBJECT_URI);
    });

    it('maps known predicates onto short field names', async () => {
      respondWithAssertion(
        assertionWith({
          'http://schema.org/headline': [{ '@value': 'A headline' }],
        }),
      );

      expect(await renderedValueOf('headline')).toBe('A headline');
    });

    it('reads object references from their @id', async () => {
      respondWithAssertion(
        assertionWith({
          'http://purl.org/dc/terms/creator': [
            { '@id': 'https://orcid.org/0000-0002-1825-0097' },
          ],
        }),
      );

      expect(await renderedValueOf('creator')).toBe(
        'https://orcid.org/0000-0002-1825-0097',
      );
    });

    it('keeps unmapped predicates under their full iri', async () => {
      respondWithAssertion(
        assertionWith({ [UNMAPPED_PREDICATE]: [{ '@value': 'Nanopublications' }] }),
      );

      expect(await renderedValueOf(UNMAPPED_PREDICATE)).toBe('Nanopublications');
    });

    it('renders empty values when the payload has no assertion graph', async () => {
      clientBehaviour.fetchNanopub.mockResolvedValue([
        { '@id': `${NANOPUB_URI}/Head`, '@graph': [{ '@id': NANOPUB_URI }] },
      ]);

      expect(await renderedValueOf('label')).toBe('');
    });
  });

  describe('template bindings', () => {
    it('binds text, attributes and markup', async () => {
      respondWithAssertion(
        assertionWith({
          'http://purl.org/dc/terms/creator': [{ '@id': 'https://orcid.org/0001' }],
        }),
      );

      const item = await mount(`
        <nanopub-item uri="${NANOPUB_URI}">
          <template>
            <article>
              <h2 data-bind="label"></h2>
              <a data-bind-href="creator" data-bind="creator"></a>
              <div data-bind-html="description"></div>
            </article>
          </template>
        </nanopub-item>
      `);

      expect(item.querySelector('h2')?.textContent).toBe('A label');
      expect(item.querySelector('a')?.getAttribute('href')).toBe(
        'https://orcid.org/0001',
      );
      expect(item.querySelector('div')?.innerHTML).toBe('<p>A description</p>');
    });

    it('converts camel-cased binding names into dashed attributes', async () => {
      const item = await mount(`
        <nanopub-item uri="${NANOPUB_URI}">
          <template><span data-bind-aria-label="label"></span></template>
        </nanopub-item>
      `);

      expect(item.querySelector('span')?.getAttribute('aria-label')).toBe('A label');
    });

    it('keeps the template in the dom so re-renders can reuse it', async () => {
      const item = await mount(`
        <nanopub-item uri="${NANOPUB_URI}">
          <template><span data-bind="label"></span></template>
        </nanopub-item>
      `);

      expect(item.querySelector('template')).not.toBeNull();
    });

    it('leaves the template definition untouched while rendering', async () => {
      const item = await mount(`
        <nanopub-item uri="${NANOPUB_URI}" link-target="_blank">
          <template><a data-bind-href="np" data-bind="label"></a></template>
        </nanopub-item>
      `);

      const templated = item.querySelector('template') as HTMLTemplateElement;
      expect(templated.content.querySelector('a')?.textContent).toBe('');
      expect(templated.content.querySelector('a')?.hasAttribute('target')).toBe(false);
    });
  });

  describe('value formatting', () => {
    beforeEach(() => {
      respondWithAssertion(
        assertionWith({
          'http://purl.org/dc/terms/created': [{ '@value': '2024-03-05T14:30:00Z' }],
          'http://xmlns.com/foaf/0.1/name': [{ '@value': 'not a date' }],
        }),
      );
    });

    /**
     * @param field the field to bind
     * @param format the value of the data-format attribute
     * @return the formatted text the component rendered
     */
    async function renderFormatted(field: string, format: string): Promise<string> {
      const item = await mount(`
        <nanopub-item uri="${NANOPUB_URI}">
          <template><span data-bind="${field}" data-format="${format}"></span></template>
        </nanopub-item>
      `);
      return item.querySelector('span')?.textContent ?? '';
    }

    it('formats a date', async () => {
      expect(await renderFormatted('created', 'date')).toBe('5 March 2024');
    });

    it('formats a date and time', async () => {
      expect(await renderFormatted('created', 'datetime')).toBe(
        '5 March 2024 at 14:30 UTC',
      );
    });

    it('leaves unparseable values alone', async () => {
      expect(await renderFormatted('name', 'date')).toBe('not a date');
    });

    it('leaves values alone for an unknown format', async () => {
      expect(await renderFormatted('created', 'epoch')).toBe('2024-03-05T14:30:00Z');
    });
  });

  describe('sanitization', () => {
    it('strips scripts from bound markup', async () => {
      respondWithAssertion(
        assertionWith({
          'http://purl.org/dc/terms/description': [
            { '@value': '<p>safe</p><script>alert(1)</script>' },
          ],
        }),
      );

      const item = await mount(`<nanopub-item uri="${NANOPUB_URI}"></nanopub-item>`);

      expect(item.querySelector('div')?.innerHTML).toBe('<p>safe</p>');
    });

    it('keeps markup out of text bindings', async () => {
      respondWithAssertion(
        assertionWith({
          'http://www.w3.org/2000/01/rdf-schema#label': [
            { '@value': '<b>bold</b>' },
          ],
        }),
      );

      const item = await mount(`<nanopub-item uri="${NANOPUB_URI}"></nanopub-item>`);

      expect(item.querySelector('p')?.querySelector('b')).toBeNull();
      expect(item.querySelector('p')?.textContent).toBe('<b>bold</b>');
    });
  });

  describe('link-target', () => {
    it('applies the target and a safe rel to rendered links', async () => {
      const item = await mount(`
        <nanopub-item uri="${NANOPUB_URI}" link-target="_blank">
          <template><a data-bind-href="np" data-bind="label"></a></template>
        </nanopub-item>
      `);

      const link = item.querySelector('a') as HTMLAnchorElement;
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    });

    it('applies the target to links coming from sanitized markup', async () => {
      respondWithAssertion(
        assertionWith({
          'http://purl.org/dc/terms/description': [
            { '@value': '<a href="https://example.org/">link</a>' },
          ],
        }),
      );

      const item = await mount(
        `<nanopub-item uri="${NANOPUB_URI}" link-target="_blank"></nanopub-item>`,
      );

      expect(item.querySelector('a')?.getAttribute('target')).toBe('_blank');
    });

    it('leaves links untouched when no target is set', async () => {
      respondWithAssertion(
        assertionWith({
          'http://purl.org/dc/terms/description': [
            { '@value': '<a href="https://example.org/">link</a>' },
          ],
        }),
      );

      const item = await mount(`<nanopub-item uri="${NANOPUB_URI}"></nanopub-item>`);

      expect(item.querySelector('a')?.hasAttribute('target')).toBe(false);
    });
  });

  describe('endpoints', () => {
    it('uses the explicit endpoint when one is given', async () => {
      await mount(
        `<nanopub-item uri="${NANOPUB_URI}" endpoint="https://chosen.example/np/"></nanopub-item>`,
      );

      expect(clientConfigs.at(-1)?.endpoints).toEqual([
        'https://chosen.example/np/',
      ]);
    });
  });

  describe('failure handling', () => {
    it('reports the error and renders nothing', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      clientBehaviour.fetchNanopub.mockRejectedValue(new Error('offline'));

      const item = await mount(`<nanopub-item uri="${NANOPUB_URI}"></nanopub-item>`);

      expect(item.children).toHaveLength(0);
      expect(consoleError).toHaveBeenCalled();
    });
  });
});
