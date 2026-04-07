# Template patterns

These are some template patterns for displaying nanopub query results using the
[HTML `<template>` element](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/template) and [nanopub-js](https://github.com/nanopublication/nanopub-js) directly if you need more control over your markup.

Define your markup in a `<template>`, then clone it once per row,
filling in fields via `data-bind` attributes. You keep full control over the
HTML structure.

## Pattern

```html
<script type="module">
  import { NanopubClient } from 'https://esm.sh/@nanopub/nanopub-js';

  const client = new NanopubClient();
  const tpl = document.querySelector('#my-template');
  const container = document.querySelector('#my-list');

  for await (const row of client.runQueryTemplate('<template-id>', { /* params */ })) {
    const clone = tpl.content.cloneNode(true);
    clone.querySelectorAll('[data-bind]').forEach(el => {
      el.textContent = row[el.dataset.bind] ?? '';
    });
    clone.querySelectorAll('[data-bind-href]').forEach(el => {
      el.href = row[el.dataset.bindHref] ?? '';
    });
    container.appendChild(clone);
  }
</script>
```

## Events list (3PFF) example

Query template: `RAkdyQ9BzXmooOF30BsFSNOs8EsSivp5k-eL293diNKXk/get-3pff-events`

Returns: `Event_Name`, `Date`, `Organizers`, `Facilitators`, `More_Info`, `Source`

```html
<template id="event-tpl">
  <li>
    <strong data-bind="Event_Name"></strong>
    <time data-bind="Date"></time>
    <a data-bind-href="More_Info">more info</a>
  </li>
</template>

<ul id="events"></ul>

<script type="module">
  import { NanopubClient } from 'https://esm.sh/@nanopub/nanopub-js';

  const client = new NanopubClient();
  const tpl = document.querySelector('#event-tpl');
  const ul = document.querySelector('#events');

  const rows = [];
  for await (const row of client.runQueryTemplate(
    'RAkdyQ9BzXmooOF30BsFSNOs8EsSivp5k-eL293diNKXk/get-3pff-events', {}
  )) {
    rows.push(row);
  }

  // Sort descending by date
  rows.sort((a, b) => new Date(b.Date) - new Date(a.Date));

  for (const row of rows) {
    const clone = tpl.content.cloneNode(true);
    clone.querySelectorAll('[data-bind]').forEach(el => {
      el.textContent = row[el.dataset.bind] ?? '';
    });
    clone.querySelectorAll('[data-bind-href]').forEach(el => {
      el.href = row[el.dataset.bindHref] ?? '';
    });
    ul.appendChild(clone);
  }
</script>
```

Note: this query returns all events at once so we collect first, then sort.
For queries that return results in order you can skip collecting and append directly.

## KP news

Query template: `RAOMMFrJj4SyF4vlvJhr_AQH0jRL2jI9RUAroP5ZKe0D8/get-news-content`

Params: `resource` (the space URI)

Returns: `headline` (may contain HTML), `body` (may contain HTML, often wrapped in `<span>`), `link`, `datePublished`, `np`

Sanitize `headline` and `body` with DOMPurify before inserting as innerHTML. Add `ADD_ATTR: ['target']` to preserve `target="_blank"` on links. The `body` value is often wrapped in a `<span>` element — unwrap it before appending so you don't get double-nested spans.

```html
<template id="news-tpl">
  <li>
    <time></time>
    <span></span>  <!-- headline + body go here as HTML after sanitizing -->
    <a>link</a>
  </li>
</template>

<ul id="news"></ul>

<script type="module">
  import { NanopubClient } from 'https://esm.sh/@nanopub/nanopub-js';
  import DOMPurify from 'https://esm.sh/dompurify';

  const client = new NanopubClient();
  const tpl = document.querySelector('#news-tpl');
  const ul = document.querySelector('#news');

  const rows = [];
  for await (const row of client.runQueryTemplate(
    'RAOMMFrJj4SyF4vlvJhr_AQH0jRL2jI9RUAroP5ZKe0D8/get-news-content',
    { resource: 'https://w3id.org/spaces/knowledgepixels' }
  )) {
    rows.push(row);
  }

  rows.sort((a, b) => new Date(b.datePublished) - new Date(a.datePublished));

  for (const row of rows) {
    const clone = tpl.content.cloneNode(true);

    const time = clone.querySelector('time');
    time.dateTime = row.datePublished ?? '';
    time.textContent = row.datePublished ?? '';

    // headline and body may contain HTML — sanitize before inserting
    const span = clone.querySelector('span');
    if (row.headline) {
      const strong = document.createElement('strong');
      strong.innerHTML = DOMPurify.sanitize(row.headline, { ADD_ATTR: ['target'] });
      span.appendChild(strong);
      if (row.body) span.appendChild(document.createTextNode(' · '));
    }
    if (row.body) {
      const tmp = document.createElement('span');
      tmp.innerHTML = DOMPurify.sanitize(row.body, { ADD_ATTR: ['target'] });
      // body is often wrapped in a <span> — unwrap if so
      const first = tmp.firstElementChild;
      if (first && first.tagName === 'SPAN' && tmp.childNodes.length === 1) {
        span.append(...first.childNodes);
      } else {
        span.append(...tmp.childNodes);
      }
    }

    const a = clone.querySelector('a');
    if (row.link) {
      a.href = row.link;
    } else {
      a.remove();
    }

    ul.appendChild(clone);
  }
</script>
```

## Adding a loading state

```html
<ul id="events">
  <li id="loading">Loading…</li>
</ul>

<script type="module">
  const loading = document.querySelector('#loading');
  let first = true;

  for await (const row of client.runQueryTemplate(...)) {
    if (first) { loading.remove(); first = false; }
    // clone and append
  }
</script>
```
