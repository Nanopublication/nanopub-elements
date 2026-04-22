# nanopub-elements

This project introduces two approaches for displaying individual nanopubs and query results on a web page.

## Web components

This repository contains a (WIP) set of custom HTML elements that fetch and render nanopub data declaratively. No JavaScript required in the page, just add the script and use the tags.

### `<nanopub-list>`

Fetches a query template and renders results as a list.

```html
<script type="module" src="https://esm.sh/@nanopub/nanopub-elements"></script>

<nanopub-list
  query-template="RAkdyQ9BzXmooOF30BsFSNOs8EsSivp5k-eL293diNKXk/get-3pff-events"
  title-field="Event_Name"
  date-field="Date"
  link-field="More_Info"
></nanopub-list>
```

For full control over the markup, add a `<template>` child. Each row is cloned from it, with fields filled in via `data-bind` attributes:

```html
<nanopub-list query-template="..." date-field="Date">
  <template>
    <li>
      <strong data-bind="Event_Name"></strong>
      <time data-bind="Date"></time>
      <a data-bind-href="More_Info">more info</a>
    </li>
  </template>
</nanopub-list>
```

Binding types available on any element inside a template:

- `data-bind="field"` — sets `textContent` (safe for plain text).
- `data-bind-html="field"` — sets `innerHTML`, sanitized via DOMPurify. Use for fields that contain markup.
- `data-bind-[attr]="field"` — sets an HTML attribute. Any attribute name works (`data-bind-href`, `data-bind-aria-label`, `data-bind-data-id`, …).

The component renders unstyled semantic HTML. Style it using the tag name as a scope:

```css
nanopub-list ul { list-style: none; }
nanopub-list time { color: gray; }
```

**Attributes:** `query-template`, `params` (JSON), `endpoint`, `title-field`, `date-field`, `link-field`, `sort` (`asc`/`desc`, default `desc`), `limit`, `group-by-year`.

### `<nanopub-table>`

Fetches a query template and renders results as an HTML table. Columns are configured via a JSON `columns` attribute.

```html
<script type="module" src="https://esm.sh/@nanopub/nanopub-elements"></script>

<nanopub-table
  query-template="RAkdyQ9BzXmooOF30BsFSNOs8EsSivp5k-eL293diNKXk/get-3pff-events"
  date-field="Date"
  columns='[
    {"field":"Event_Name","label":"Event"},
    {"field":"Date","label":"Date","type":"date"},
    {"field":"Organizers","label":"Organizers"},
    {"field":"Facilitators","label":"Facilitators"},
    {"field":"More_Info","label":"More Info","type":"link"}
  ]'
></nanopub-table>
```

If `columns` is omitted, all fields from the query result are shown with their raw field names as headers.

Each column entry has:

- `field` — the query result field name
- `label` — the column header text
- `type` — `"text"` (default), `"date"` (renders a `<time>` element), or `"link"` (renders an `<a>` element)

For full control over cell markup (e.g. a link whose visible text differs from its href, splitting multi-value cells, conditional formatting), add a `<template>` child. Each row is cloned from it and populated via the same `data-bind` attributes as `<nanopub-list>`:

```html
<nanopub-table
  query-template="RAkdyQ9BzXmooOF30BsFSNOs8EsSivp5k-eL293diNKXk/get-3pff-events"
  date-field="Date"
  columns='[
    {"field":"Event_ID","label":"Event ID"},
    {"field":"Event_Name","label":"Event Name"},
    {"field":"Date","label":"Date"},
    {"field":"More_Info","label":"More Info"}
  ]'
>
  <template>
    <tr>
      <td><a data-bind-href="Event_ID" data-bind="Event_ID__label"></a></td>
      <td data-bind="Event_Name"></td>
      <td><time data-bind="Date"></time></td>
      <td><a data-bind-href="More_Info">more info</a></td>
    </tr>
  </template>
</nanopub-table>
```

The `columns` attribute, when present alongside a `<template>`, is used for the header row only; column `type` is ignored since the template defines the cell markup. If `columns` is omitted, no header row is rendered — author your own `<thead>` elsewhere on the page if you need one.

Style the table using the tag name as a scope:

```css
nanopub-table table { border-collapse: collapse; width: 100%; }
nanopub-table th, nanopub-table td { padding: 0.5rem 0.75rem; border-bottom: 1px solid #eee; }
nanopub-table th { background: #f5f5f5; }
nanopub-table time { color: gray; }
```

**Attributes:** `query-template`, `params` (JSON), `endpoint`, `columns` (JSON), `date-field`, `sort` (`asc`/`desc`, default `desc`), `limit`.

### `<nanopub-item>`

Fetches a single nanopub by URI and renders fields from its assertion graph.

```html
<script type="module" src="https://esm.sh/@nanopub/nanopub-elements"></script>

<nanopub-item uri="https://w3id.org/np/RA..."></nanopub-item>
```

With no template child, the element renders a minimal default: a `<p>` for `label` and a `<div>` for `description` (HTML). For full control, supply a `<template>`:

```html
<nanopub-item uri="https://w3id.org/np/RA...">
  <template>
    <h3 data-bind="label"></h3>
    <p><em data-bind="startDate" data-format="datetime"></em></p>
    <div data-bind-html="description"></div>
  </template>
</nanopub-item>
```

Well-known assertion fields exposed to bindings: `label`, `description`, `comment`, `name`, `startDate`, `endDate`, `created`, `creator`, `headline`, `datePublished`. Raw predicate IRIs also work (e.g. `data-bind="http://purl.org/dc/terms/title"`). `np` is always set to the nanopub URI.

Add `data-format="date"` or `data-format="datetime"` to any binding to render ISO date values via `toLocaleString`.

`<nanopub-item>` composes naturally inside a `<nanopub-list>` template when the query returns nanopub URIs but not the assertion fields you want to display:

```html
<nanopub-list query-template="..." params='...'>
  <template>
    <li>
      <nanopub-item data-bind-uri="np">
        <template>
          <strong data-bind="label"></strong>
          <div data-bind-html="description"></div>
        </template>
      </nanopub-item>
    </li>
  </template>
</nanopub-list>
```

**Attributes:** `uri`, `endpoint`.

## HTML template patterns

If you prefer to write JavaScript directly rather than use a web component, see [templates.md](templates.md). It shows how to use the native HTML `<template>` element together with [nanopub-js](https://github.com/nanopublication/nanopub-js) to fetch and render query results with full control over the markup and logic — as either a list or a table.

## Development

```sh
yarn install
yarn build        # compile to dist/
yarn build:watch  # recompile on changes
yarn serve        # serve the project at http://localhost:3000
```

Examples are in `examples/`. Run `yarn serve` and open them at:

- `http://localhost:3000/examples/component/events.html` — `<nanopub-table>` component
- `http://localhost:3000/examples/component/news.html` — `<nanopub-list>` component
- `http://localhost:3000/examples/component/nanosessions.html`
- `http://localhost:3000/examples/component/nanopub-item.html` — `<nanopub-item>` component
- `http://localhost:3000/examples/template/events.html` — HTML template (table)
- `http://localhost:3000/examples/template/news.html` — HTML template (list)
- `http://localhost:3000/examples/template/author.html`
- `http://localhost:3000/examples/template/nanopub-item.html` — HTML template (single nanopub)
