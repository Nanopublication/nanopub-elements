# nanopub-elements

There are two approaches for displaying nanopub query results on a web page.

## Web components

This repository contains a (WIP) set of custom HTML elements that fetch and render nanopub data declaratively. No JavaScript required in the page, just add the script and use the tags.

Currently available:

* `<nanopub-list>`: fetches a query template and renders results as a list.

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

The component renders unstyled semantic HTML. Style it using the tag name as a scope:

```css
nanopub-list ul { list-style: none; }
nanopub-list time { color: gray; }
```

## HTML template patterns

If you prefer to write JavaScript directly rather than use a web component, see [templates.md](templates.md). It shows how to use the native HTML `<template>` element together with [nanopub-js](https://github.com/nanopublication/nanopub-js) to fetch and render query results with full control over the markup and logic.

## Development

```sh
yarn install
yarn build        # compile to dist/
yarn build:watch  # recompile on changes
yarn serve        # serve the project at http://localhost:3000
```

Examples are in `examples/`. Run `yarn serve` and open them at:

* `http://localhost:3000/examples/component/events.html`
* `http://localhost:3000/examples/component/news.html`
* `http://localhost:3000/examples/component/nanosessions.html`
* `http://localhost:3000/examples/template/events.html`
* `http://localhost:3000/examples/template/news.html`
* `http://localhost:3000/examples/template/author.html`
