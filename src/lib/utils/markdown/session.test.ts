import { describe, expect, test } from "bun:test";
import { createRenderSession } from "./session";

describe("createRenderSession", () => {
  test("invalidates older asynchronous render results", () => {
    const session = createRenderSession();
    const first = session.invalidate();
    const second = session.invalidate();

    expect(first).toBe(1);
    expect(second).toBe(2);
    expect(session.current()).toBe(2);
    expect(session.isCurrent(first)).toBe(false);
    expect(session.isCurrent(second)).toBe(true);
  });
});
