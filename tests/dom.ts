const PENDING_TASK_ROUNDS = 10;

/**
 * Lets every pending timer and promise callback run. Components defer their
 * first load with {@code setTimeout} and then await the client, so rendering
 * only settles after several turns of the event loop.
 */
export async function flushPendingWork(): Promise<void> {
  for (let round = 0; round < PENDING_TASK_ROUNDS; round++) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

/**
 * Parses the given markup into the document body and waits for the resulting
 * element to finish rendering.
 *
 * @param html the markup to mount, whose first element is the element under test
 * @return the mounted element, fully rendered
 */
export async function mount(html: string): Promise<HTMLElement> {
  document.body.innerHTML = html;
  await flushPendingWork();
  return document.body.firstElementChild as HTMLElement;
}

/**
 * Removes everything mounted by {@link mount}, so custom elements disconnect
 * and abort their in-flight work before the next test starts.
 */
export function unmountAll(): void {
  document.body.innerHTML = '';
}

/**
 * @param element the rendered element to read
 * @param selector the CSS selector matching the nodes of interest
 * @return the trimmed text of every matching node, in document order
 */
export function textOf(element: Element, selector: string): string[] {
  return [...element.querySelectorAll(selector)].map(node =>
    (node.textContent ?? '').trim(),
  );
}
