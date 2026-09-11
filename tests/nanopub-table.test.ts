import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clientBehaviour,
  clientConfigs,
  resetNanopubJsMock,
  respondWithQueryFailure,
  respondWithRows,
  type QueryRow,
} from './nanopub-js-mock.js';
import { mount, textOf, unmountAll } from './dom.js';

vi.mock('@nanopub/nanopub-js', async () => {
  const mock = await import('./nanopub-js-mock.js');
  return mock.nanopubJsModuleMock();
});

await import('../src/index.js');

const QUERY_TEMPLATE = 'RAexample-query';

const COLUMNS = `[
  {"field":"label","label":"Title"},
  {"field":"link","label":"Source","type":"link"},
  {"field":"date","label":"Published","type":"date"}
]`;

const PUBLICATIONS: QueryRow[] = [
  { label: 'Middle', date: '2022-06-01', link: 'https://example.org/middle' },
  { label: 'Newest', date: '2024-02-01', link: 'https://example.org/newest' },
  { label: 'Oldest', date: '2020-01-01', link: 'https://example.org/oldest' },
];

/**
 * Mounts a table bound to the shared query template.
 *
 * @param attributes extra attributes for the element
 * @param children markup to nest inside the element
 * @return the rendered table element
 */
function mountTable(attributes = '', children = ''): Promise<HTMLElement> {
  return mount(
    `<nanopub-table query-template="${QUERY_TEMPLATE}" ${attributes}>${children}</nanopub-table>`,
  );
}

describe('nanopub-table', () => {
  beforeEach(() => {
    resetNanopubJsMock();
    respondWithRows(PUBLICATIONS);
  });

  afterEach(() => {
    unmountAll();
    vi.restoreAllMocks();
  });

  describe('lifecycle', () => {
    it('does nothing without a query template', async () => {
      const table = await mount('<nanopub-table></nanopub-table>');

      expect(table.children).toHaveLength(0);
      expect(clientBehaviour.runQueryTemplate).not.toHaveBeenCalled();
    });

    it('shows a loading message while results are still streaming', async () => {
      clientBehaviour.runQueryTemplate.mockImplementation(async function* () {
        await new Promise(() => {});
      });

      const table = await mountTable();

      expect(table.textContent?.trim()).toBe('Loading…');
    });

    it('reports an empty result set', async () => {
      respondWithRows([]);

      const table = await mountTable(`columns='${COLUMNS}'`);

      expect(table.textContent?.trim()).toBe('No items found.');
      expect(table.querySelector('table')).toBeNull();
    });

    it('reports a failed query', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      respondWithQueryFailure(new Error('offline'));

      const table = await mountTable(`columns='${COLUMNS}'`);

      expect(table.textContent?.trim()).toBe('Failed to load.');
      expect(consoleError).toHaveBeenCalled();
    });
  });

  describe('query parameters', () => {
    it('forwards parsed params to the query template', async () => {
      await mountTable(`params='{"author":"0000-0002-1825-0097"}'`);

      expect(clientBehaviour.runQueryTemplate).toHaveBeenCalledWith(QUERY_TEMPLATE, {
        author: '0000-0002-1825-0097',
      });
    });

    it('ignores malformed params instead of failing', async () => {
      const table = await mountTable(`params="{not json}"`);

      expect(clientBehaviour.runQueryTemplate).toHaveBeenCalledWith(QUERY_TEMPLATE, {});
      expect(table.querySelectorAll('tbody tr')).toHaveLength(3);
    });

    it('uses the explicit endpoint when one is given', async () => {
      await mountTable('endpoint="https://chosen.example/np/"');

      expect(clientConfigs.at(-1)?.endpoints).toEqual(['https://chosen.example/np/']);
    });
  });

  describe('columns', () => {
    it('renders a header from the configured labels', async () => {
      const table = await mountTable(`columns='${COLUMNS}'`);

      expect(textOf(table, 'thead th')).toEqual(['Title', 'Source', 'Published']);
    });

    it('renders one row per result in column order', async () => {
      const table = await mountTable(`columns='${COLUMNS}' date-field="date"`);

      const firstRow = table.querySelector('tbody tr') as HTMLTableRowElement;
      expect(textOf(firstRow, 'td')).toEqual([
        'Newest',
        'https://example.org/newest',
        '2024-02-01',
      ]);
    });

    it('derives columns from the first row when none are configured', async () => {
      const table = await mountTable();

      expect(textOf(table, 'thead th')).toEqual(['label', 'date', 'link']);
      expect(table.querySelectorAll('tbody tr')).toHaveLength(3);
    });

    it('falls back to derived columns when the configuration is malformed', async () => {
      const table = await mountTable(`columns="{not json}"`);

      expect(textOf(table, 'thead th')).toEqual(['label', 'date', 'link']);
    });

    it('renders an empty cell when a row is missing a field', async () => {
      respondWithRows([{ label: 'Only a label' }]);

      const table = await mountTable(`columns='${COLUMNS}'`);

      expect(textOf(table, 'tbody td')).toEqual(['Only a label', '', '']);
    });
  });

  describe('cell types', () => {
    it('renders link columns as anchors', async () => {
      const table = await mountTable(`columns='${COLUMNS}' date-field="date"`);

      const link = table.querySelector('tbody td a') as HTMLAnchorElement;
      expect(link.getAttribute('href')).toBe('https://example.org/newest');
      expect(link.textContent).toBe('https://example.org/newest');
    });

    it('renders date columns as time elements', async () => {
      const table = await mountTable(`columns='${COLUMNS}' date-field="date"`);

      const time = table.querySelector('tbody td time') as HTMLTimeElement;
      expect(time.getAttribute('datetime')).toBe('2024-02-01');
    });

    it('strips scripts from text columns', async () => {
      respondWithRows([{ label: '<b>bold</b><script>alert(1)</script>' }]);

      const table = await mountTable(`columns='[{"field":"label","label":"Title"}]'`);

      expect(table.querySelector('tbody td')?.innerHTML).toBe('<b>bold</b>');
    });
  });

  describe('sorting and limiting', () => {
    it('sorts by date descending by default', async () => {
      const table = await mountTable(`columns='${COLUMNS}' date-field="date"`);

      expect(textOf(table, 'tbody tr td:first-child')).toEqual([
        'Newest',
        'Middle',
        'Oldest',
      ]);
    });

    it('sorts by date ascending when asked', async () => {
      const table = await mountTable(
        `columns='${COLUMNS}' date-field="date" sort="asc"`,
      );

      expect(textOf(table, 'tbody tr td:first-child')).toEqual([
        'Oldest',
        'Middle',
        'Newest',
      ]);
    });

    it('keeps the query order when no date field is configured', async () => {
      const table = await mountTable(`columns='${COLUMNS}'`);

      expect(textOf(table, 'tbody tr td:first-child')).toEqual([
        'Middle',
        'Newest',
        'Oldest',
      ]);
    });

    it('applies the limit after sorting', async () => {
      const table = await mountTable(
        `columns='${COLUMNS}' date-field="date" limit="2"`,
      );

      expect(textOf(table, 'tbody tr td:first-child')).toEqual(['Newest', 'Middle']);
    });
  });

  describe('template rendering', () => {
    const ROW_TEMPLATE = `
      <template>
        <tr>
          <td><a data-bind-href="link" data-bind="label"></a></td>
          <td data-bind="date"></td>
        </tr>
      </template>
    `;

    it('clones the template once per row and binds its fields', async () => {
      const table = await mountTable('date-field="date"', ROW_TEMPLATE);

      expect(table.querySelectorAll('tbody tr')).toHaveLength(3);
      const firstRow = table.querySelector('tbody tr') as HTMLTableRowElement;
      expect(firstRow.querySelector('a')?.textContent).toBe('Newest');
      expect(firstRow.querySelector('a')?.getAttribute('href')).toBe(
        'https://example.org/newest',
      );
    });

    it('omits the header when the template supplies its own markup', async () => {
      const table = await mountTable('', ROW_TEMPLATE);

      expect(table.querySelector('thead')).toBeNull();
    });

    it('still renders a header when columns are configured alongside a template', async () => {
      const table = await mountTable(`columns='${COLUMNS}'`, ROW_TEMPLATE);

      expect(textOf(table, 'thead th')).toEqual(['Title', 'Source', 'Published']);
    });

    it('keeps the template in the dom after rendering', async () => {
      const table = await mountTable('', ROW_TEMPLATE);

      expect(table.querySelector('template')).not.toBeNull();
    });

    it('strips scripts from markup bindings', async () => {
      respondWithRows([{ label: '<i>hi</i><script>alert(1)</script>' }]);

      const table = await mountTable(
        '',
        '<template><tr><td data-bind-html="label"></td></tr></template>',
      );

      expect(table.querySelector('tbody td')?.innerHTML).toBe('<i>hi</i>');
    });
  });

  describe('link-target', () => {
    it('applies the target and a safe rel to every rendered link', async () => {
      const table = await mountTable(`columns='${COLUMNS}' link-target="_blank"`);

      const links = [...table.querySelectorAll('a')];
      expect(links).toHaveLength(3);
      expect(links.every(link => link.getAttribute('target') === '_blank')).toBe(true);
      expect(
        links.every(link => link.getAttribute('rel') === 'noopener noreferrer'),
      ).toBe(true);
    });

    it('leaves links untouched when no target is set', async () => {
      const table = await mountTable(`columns='${COLUMNS}'`);

      expect(table.querySelector('a')?.hasAttribute('target')).toBe(false);
    });
  });
});
