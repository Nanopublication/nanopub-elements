import DOMPurify from 'dompurify';

export type Row = Record<string, string>;

export function formatValue(value: string, format: string | null): string {
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

/** Splits a multi-value field: on newlines if it has any, otherwise on whitespace. */
export function splitValues(value: string, separator?: string): string[] {
  const parts = separator
    ? value.split(separator)
    : value.split(value.includes('\n') ? '\n' : /\s+/);
  return parts.map(part => part.trim()).filter(Boolean);
}

/**
 * Fills data-bind, data-bind-html and data-bind-[attr] from the row, and
 * repeats each <template data-bind-each="Field"> once per value of the field,
 * with the value bound as ".".
 */
export function applyBindings(root: ParentNode, row: Row): void {
  root.querySelectorAll('*').forEach(el => {
    const { dataset } = el as HTMLElement;
    const format = dataset.format ?? null;
    for (const [key, field] of Object.entries(dataset)) {
      if (!field || !key.startsWith('bind') || key === 'bindEach') continue;
      const value = formatValue(row[field] ?? '', format);
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

  root.querySelectorAll<HTMLTemplateElement>('template[data-bind-each]').forEach(template => {
    const { bindEach, separator } = template.dataset;
    for (const value of splitValues(row[bindEach!] ?? '', separator)) {
      const clone = template.content.cloneNode(true) as DocumentFragment;
      applyBindings(clone, { ...row, '.': value });
      template.before(clone);
    }
    template.remove();
  });
}
