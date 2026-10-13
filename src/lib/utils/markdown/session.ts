/** A monotonic token used to reject stale asynchronous render results. */
export interface RenderSession {
  current(): number;
  invalidate(): number;
  isCurrent(version: number): boolean;
}

export function createRenderSession(): RenderSession {
  let version = 0;

  return {
    current: () => version,
    invalidate: () => {
      version += 1;
      return version;
    },
    isCurrent: (candidate) => candidate === version,
  };
}
