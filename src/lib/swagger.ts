import { createSwaggerSpec } from "next-swagger-doc";

export function getApiDocs() {
  return createSwaggerSpec({
    apiFolder: "src/app/api",
    definition: {
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
        },
      },
    },
  });
}
