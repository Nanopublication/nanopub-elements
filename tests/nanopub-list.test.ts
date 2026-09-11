import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clientBehaviour,
  clientConfigs,
  resetNanopubJsMock,
  respondWithQueryFailure,
  respondWithRows,
  type QueryRow,
} from './nanopub-js-mock.js';
import { flushPendingWork, mount, textOf, unmountAll } from './dom.js';

vi.mock('@nanopub/nanopub-js', async () => {
  const mock = await import('./nanopub-js-mock.js');
  return mock.nanopubJsModuleMock();
});

await import('../src/index.js');

const QUERY_TEMPLATE = 'RAexample-query';

const NEWS: QueryRow[] = [
  { label: 'Middle', date: '2022-06-01', link: 'https://example.org/middle' },
  { label: 'Newest', date: '2024-02-01', link: 'https://example.org/newest' },
  { label: 'Oldest', date: '2020-01-01', link: 'https://example.org/oldest' },
];

/**
 * Mounts a list bound to the shared query template.
 *
 * @param attributes extra attributes for the element
 * @param children markup to nest inside the element
 * @return the rendered list element
 */
function mountList(attributes = '', children = ''): Promise<HTMLElement> {
  return mount(
    `<nanopub-list query-template="${QUERY_TEMPLATE}" ${attributes}>${children}</nanopub-list>`,
  );
}

describe('nanopub-list', () => {
  beforeEach(() => {
    resetNanopubJsMock();
    respondWithRows(NEWS);
  });

  afterEach(() => {
    unmountAll();
    vi.restoreAllMocks();
  });

  describe('lifecycle', () => {
    it('does nothing without a query template', async () => {
      const list = await mount('<nanopub-list></nanopub-list>');

      expect(list.children).toHaveLength(0);
      expect(clientBehaviour.runQueryTemplate).not.toHaveBeenCalled();
    });

    it('shows a loading message while results are still streaming', async () => {
      clientBehaviour.runQueryTemplate.mockImplementation(async function* () {
        await new Promise(() => {});
      });

      const list = await mountList();

      expect(list.textContent?.trim()).toBe('Loading…');
    });

    it('reports an empty result set', async () => {
      respondWithRows([]);

      const list = await mountList();

      expect(list.textContent?.trim()).toBe('No items found.');
    });

    it('reports a failed query', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      respondWithQueryFailure(new Error('offline'));

      const list = await mountList();

      expect(list.textContent?.trim()).toBe('Failed to load.');
      expect(consoleError).toHaveBeenCalled();
    });
  });

  describe('query parameters', () => {
    it('forwards parsed params to the query template', async () => {
      await mountList(`params='{"author":"0000-0002-1825-0097"}'`);

      expect(clientBehaviour.runQueryTemplate).toHaveBeenCalledWith(QUERY_TEMPLATE, {
        author: '0000-0002-1825-0097',
      });
    });

    it('ignores malformed params instead of failing', async () => {
      const list = await mountList(`params="{not json}"`);

      expect(clientBehaviour.runQueryTemplate).toHaveBeenCalledWith(QUERY_TEMPLATE, {});
      expect(list.querySelectorAll('li')).toHaveLength(3);
    });

    it('uses the explicit endpoint when one is given', async () => {
      await mountList('endpoint="https://chosen.example/np/"');

      expect(clientConfigs.at(-1)?.endpoints).toEqual(['https://chosen.example/np/']);
    });
  });

  describe('default rendering', () => {
    it('renders one item per row with title, link and date', async () => {
      const list = await mountList('date-field="date" link-field="link"');

      const first = list.querySelector('li') as HTMLLIElement;
      expect(first.querySelector('span')?.textContent).toBe('Newest');
      expect(first.querySelector('a')?.getAttribute('href')).toBe(
        'https://example.org/newest',
      );
      expect(first.querySelector('time')?.getAttribute('datetime')).toBe('2024-02-01');
      expect(first.dataset.date).toBe('2024-02-01');
    });

    it('reads the title from the configured field', async () => {
      respondWithRows([{ headline: 'Custom title' }]);

      const list = await mountList('title-field="headline"');

      expect(textOf(list, 'li span')).toEqual(['Custom title']);
    });

    it('omits the link when the row has no value for it', async () => {
      respondWithRows([{ label: 'No link' }]);

      const list = await mountList('link-field="link"');

      expect(list.querySelector('a')).toBeNull();
    });

    it('strips scripts from titles', async () => {
      respondWithRows([{ label: '<b>bold</b><script>alert(1)</script>' }]);

      const list = await mountList();

      expect(list.querySelector('li span')?.innerHTML).toBe('<b>bold</b>');
    });
  });

  describe('sorting and limiting', () => {
    it('sorts by date descending by default', async () => {
      const list = await mountList('date-field="date"');

      expect(textOf(list, 'li span')).toEqual(['Newest', 'Middle', 'Oldest']);
    });

    it('sorts by date ascending when asked', async () => {
      const list = await mountList('date-field="date" sort="asc"');

      expect(textOf(list, 'li span')).toEqual(['Oldest', 'Middle', 'Newest']);
    });

    it('keeps the query order when no date field is configured', async () => {
      const list = await mountList();

      expect(textOf(list, 'li span')).toEqual(['Middle', 'Newest', 'Oldest']);
    });

    it('sorts rows without a date last when sorting descending', async () => {
      respondWithRows([{ label: 'Undated' }, ...NEWS]);

      const list = await mountList('date-field="date"');

      expect(textOf(list, 'li span').at(-1)).toBe('Undated');
    });

    it('applies the limit after sorting', async () => {
      const list = await mountList('date-field="date" limit="2"');

      expect(textOf(list, 'li span')).toEqual(['Newest', 'Middle']);
    });
  });

  describe('grouping by year', () => {
    it('renders one section per year, newest first', async () => {
      const list = await mountList('date-field="date" group-by-year');

      const years = [...list.querySelectorAll('section')].map(
        section => (section as HTMLElement).dataset.year,
      );
      expect(years).toEqual(['2024', '2022', '2020']);
      expect(textOf(list, 'section h3')).toEqual(['2024', '2022', '2020']);
    });

    it('places each row under its own year', async () => {
      const list = await mountList('date-field="date" group-by-year');

      const section = list.querySelector('section[data-year="2022"]') as HTMLElement;
      expect(textOf(section, 'li span')).toEqual(['Middle']);
    });

    it('orders sections oldest first when sorting ascending', async () => {
      const list = await mountList('date-field="date" group-by-year sort="asc"');

      expect(textOf(list, 'section h3')).toEqual(['2020', '2022', '2024']);
    });

    it('falls back to a flat list when no date field is configured', async () => {
      const list = await mountList('group-by-year');

      expect(list.querySelectorAll('section')).toHaveLength(0);
      expect(list.querySelectorAll('li')).toHaveLength(3);
    });
  });

  describe('template rendering', () => {
    const ITEM_TEMPLATE = `
      <template>
        <li>
          <a data-bind-href="link" data-bind="label"></a>
          <time data-bind-datetime="date"></time>
        </li>
      </template>
    `;

    it('clones the template once per row and binds its fields', async () => {
      const list = await mountList('date-field="date"', ITEM_TEMPLATE);

      expect(list.querySelectorAll('ul > li')).toHaveLength(3);
      const first = list.querySelector('li') as HTMLLIElement;
      expect(first.querySelector('a')?.textContent).toBe('Newest');
      expect(first.querySelector('a')?.getAttribute('href')).toBe(
        'https://example.org/newest',
      );
      expect(first.querySelector('time')?.getAttribute('datetime')).toBe('2024-02-01');
    });

    it('binds missing fields as empty rather than leaving placeholders', async () => {
      respondWithRows([{ label: 'Only a label' }]);

      const list = await mountList('', ITEM_TEMPLATE);

      expect(list.querySelector('a')?.getAttribute('href')).toBe('');
    });

    it('uses the template inside year sections too', async () => {
      const list = await mountList('date-field="date" group-by-year', ITEM_TEMPLATE);

      const section = list.querySelector('section[data-year="2020"]') as HTMLElement;
      expect(textOf(section, 'li a')).toEqual(['Oldest']);
    });

    it('keeps the template in the dom after rendering', async () => {
      const list = await mountList('', ITEM_TEMPLATE);

      expect(list.querySelector('template')).not.toBeNull();
    });

    it('strips scripts from markup bindings', async () => {
      respondWithRows([{ label: '<i>hi</i><script>alert(1)</script>' }]);

      const list = await mountList(
        '',
        '<template><li><div data-bind-html="label"></div></li></template>',
      );

      expect(list.querySelector('li div')?.innerHTML).toBe('<i>hi</i>');
    });
  });

  describe('link-target', () => {
    it('applies the target and a safe rel to every rendered link', async () => {
      const list = await mountList('link-field="link" link-target="_blank"');

      const links = [...list.querySelectorAll('a')];
      expect(links).toHaveLength(3);
      expect(links.every(link => link.getAttribute('target') === '_blank')).toBe(true);
      expect(
        links.every(link => link.getAttribute('rel') === 'noopener noreferrer'),
      ).toBe(true);
    });

    it('leaves links untouched when no target is set', async () => {
      const list = await mountList('link-field="link"');

      expect(list.querySelector('a')?.hasAttribute('target')).toBe(false);
    });
  });

  describe('reloading', () => {
    it('re-runs the query when an observed attribute changes', async () => {
      const list = await mountList('date-field="date"');
      respondWithRows([{ label: 'Reloaded', date: '2025-01-01' }]);

      list.setAttribute('limit', '1');
      await flushPendingWork();

      expect(textOf(list, 'li span')).toEqual(['Reloaded']);
    });

    it('abandons an in-flight query when the element is disconnected', async () => {
      let releaseQuery = () => {};
      clientBehaviour.runQueryTemplate.mockImplementation(async function* () {
        await new Promise<void>(resolve => {
          releaseQuery = resolve;
        });
        yield { label: 'Late' };
      });

      const list = await mountList();
      expect(list.textContent?.trim()).toBe('Loading…');

      list.remove();
      releaseQuery();
      await flushPendingWork();

      expect(list.querySelectorAll('li')).toHaveLength(0);
    });

    it('ignores a slow response that a newer load has superseded', async () => {
      let releaseStaleQuery = () => {};
      clientBehaviour.runQueryTemplate.mockImplementationOnce(async function* () {
        await new Promise<void>(resolve => {
          releaseStaleQuery = resolve;
        });
        yield { label: 'Stale' };
      });

      const list = await mountList();
      respondWithRows([{ label: 'Fresh' }]);

      list.setAttribute('limit', '5');
      await flushPendingWork();
      releaseStaleQuery();
      await flushPendingWork();

      expect(textOf(list, 'li span')).toEqual(['Fresh']);
    });
  });
});
