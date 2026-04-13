declare module "bun:test" {
  export function describe(label: string, fn: () => void): void;
  export function test(label: string, fn: () => void): void;
  export function expect<T>(actual: T): {
    toBe(expected: unknown): void;
    toContain(expected: unknown): void;
    toHaveLength(expected: number): void;
    toMatch(expected: string | RegExp): void;
    toThrow(expected?: string | RegExp): void;
    toBeGreaterThan(expected: number): void;
    toBeGreaterThanOrEqual(expected: number): void;
  };
}
