import { describe, it, expect } from "vitest";
import { isExcludedFile } from "@/lib/collector/git-clone";

describe("isExcludedFile", () => {
  it("excludes lock files", () => {
    expect(isExcludedFile("package-lock.json")).toBe(true);
    expect(isExcludedFile("yarn.lock")).toBe(true);
    expect(isExcludedFile("pnpm-lock.yaml")).toBe(true);
    expect(isExcludedFile("Gemfile.lock")).toBe(true);
    expect(isExcludedFile("Cargo.lock")).toBe(true);
    expect(isExcludedFile("poetry.lock")).toBe(true);
    expect(isExcludedFile("composer.lock")).toBe(true);
  });

  it("excludes generated files", () => {
    expect(isExcludedFile("schema.generated.ts")).toBe(true);
    expect(isExcludedFile("types.generated.d.ts")).toBe(true);
  });

  it("excludes dist and build directories", () => {
    expect(isExcludedFile("dist/index.js")).toBe(true);
    expect(isExcludedFile("build/output.js")).toBe(true);
    expect(isExcludedFile("src/dist/bundle.js")).toBe(true);
    expect(isExcludedFile("packages/build/main.js")).toBe(true);
  });

  it("includes regular source files", () => {
    expect(isExcludedFile("src/index.ts")).toBe(false);
    expect(isExcludedFile("README.md")).toBe(false);
    expect(isExcludedFile("package.json")).toBe(false);
    expect(isExcludedFile("src/components/App.tsx")).toBe(false);
    expect(isExcludedFile("lib/utils.py")).toBe(false);
  });

  it("does not exclude files with 'lock' in the name but not as extension", () => {
    expect(isExcludedFile("src/lock-manager.ts")).toBe(false);
    expect(isExcludedFile("docs/locking.md")).toBe(false);
  });
});
