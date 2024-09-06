export default function debounce<T extends (this: any, ...args: any[]) => any>(
  fn: T,
  ms?: number,
  beforeUnload?: true,
): T;
export default function debounce<T extends (this: any, ...args: any[]) => any>(
  fn: T,
  ms: number,
  beforeUnload: false,
): T & { execute: () => void };
export default function debounce(fn: (...args: any[]) => any, ms = 50, beforeUnload = true) {
  const data: { timeout: number | null; callback: (() => void) | null } = {
    timeout: null,
    callback: null,
  };

  function debounced(this: any, ...args: any[]) {
    if (data.timeout) clearTimeout(data.timeout);
    const execute = () => {
      fn.apply(this, args);

      clearTimeout(data.timeout!);
      data.timeout = null;
      data.callback = null;
    };
    data.callback = execute;
    data.timeout = window.setTimeout(execute, ms);
  }

  if (beforeUnload) {
    window.addEventListener('beforeunload', () => {
      data.callback?.();
    });
  } else {
    debounced.execute = () => {
      data.callback?.();
    };
  }

  return debounced;
}
