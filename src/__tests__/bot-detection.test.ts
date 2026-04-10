import { describe, it, expect } from "vitest";
import { isBot, BOT_LOGINS } from "@/lib/github/client";

describe("isBot", () => {
  it("detects known bot logins", () => {
    expect(isBot("dependabot[bot]")).toBe(true);
    expect(isBot("renovate[bot]")).toBe(true);
    expect(isBot("github-actions[bot]")).toBe(true);
    expect(isBot("codecov[bot]")).toBe(true);
  });

  it("detects any login ending with [bot]", () => {
    expect(isBot("my-custom-app[bot]")).toBe(true);
    expect(isBot("random-service[bot]")).toBe(true);
  });

  it("returns false for regular users", () => {
    expect(isBot("octocat")).toBe(false);
    expect(isBot("torvalds")).toBe(false);
    expect(isBot("john-doe")).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(isBot(null)).toBe(false);
    expect(isBot(undefined)).toBe(false);
  });

  it("BOT_LOGINS set contains expected entries", () => {
    expect(BOT_LOGINS.has("dependabot[bot]")).toBe(true);
    expect(BOT_LOGINS.has("semantic-release-bot")).toBe(true);
    expect(BOT_LOGINS.size).toBeGreaterThanOrEqual(10);
  });
});
