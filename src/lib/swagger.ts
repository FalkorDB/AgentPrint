import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

/** Extract @swagger YAML blocks from JSDoc comments in a source file. */
function extractSwaggerBlocks(source: string): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = [];
  const commentRegex = /\/\*\*[\s\S]*?\*\//g;
  let match: RegExpExecArray | null;

  while ((match = commentRegex.exec(source)) !== null) {
    const comment = match[0];
    if (!comment.includes("@swagger")) continue;

    const yaml = comment
      .split("\n")
      .slice(1, -1) // drop opening /** and closing */
      .map((line) => line.replace(/^\s*\*\s?/, "")) // strip leading " * "
      .filter((_, i, arr) => {
        // drop lines up to and including the @swagger tag
        const swaggerIdx = arr.findIndex((l) => l.trim() === "@swagger");
        return i > swaggerIdx;
      })
      .join("\n");

    if (yaml.trim()) {
      const parsed = parseYaml(yaml) as Record<string, unknown>;
      if (parsed && typeof parsed === "object") blocks.push(parsed);
    }
  }

  return blocks;
}

/** Recursively collect swagger annotations from route files. */
function collectAnnotations(dir: string): Record<string, unknown>[] {
  const entries = readdirSync(dir, { withFileTypes: true, recursive: true });
  const blocks: Record<string, unknown>[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = entry.name.slice(entry.name.lastIndexOf("."));
    if (!EXTENSIONS.has(ext)) continue;

    const filePath = join(entry.parentPath ?? entry.path, entry.name);
    const source = readFileSync(filePath, "utf-8");
    blocks.push(...extractSwaggerBlocks(source));
  }

  return blocks;
}

/** Deep-merge OpenAPI path/component objects. */
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  for (const key of Object.keys(source)) {
    const srcVal = source[key];
    const tgtVal = target[key];
    if (
      srcVal &&
      typeof srcVal === "object" &&
      !Array.isArray(srcVal) &&
      tgtVal &&
      typeof tgtVal === "object" &&
      !Array.isArray(tgtVal)
    ) {
      target[key] = deepMerge(
        tgtVal as Record<string, unknown>,
        srcVal as Record<string, unknown>,
      );
    } else {
      target[key] = srcVal;
    }
  }
  return target;
}

export function getApiDocs() {
  const apiDir = join(process.cwd(), "src/app/api");
  const blocks = collectAnnotations(apiDir);

  const spec: Record<string, unknown> = {
    openapi: "3.0.0",
    info: {
      title: "AgentPrint API",
      version: "1.0.0",
      description:
        "GitHub project velocity tracker — measures the fingerprint AI coding agents leave on open-source projects.",
    },
    components: {
      securitySchemes: {
        session: {
          type: "apiKey",
          in: "cookie",
          name: "authjs.session-token",
          description: "NextAuth.js session cookie (login via /login)",
        },
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description:
            "API token created via POST /api/tokens. Use the raw token value as the bearer token.",
        },
      },
    },
    paths: {},
  };

  for (const block of blocks) {
    deepMerge(spec, { paths: block });
  }

  return spec;
}

