"use client";

import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function ReactSwagger({ spec }: { spec: Record<string, any> }) {
  return (
    <div className="swagger-wrapper">
      <SwaggerUI spec={spec} />
      <style>{`
        .swagger-wrapper .swagger-ui { background: transparent; }
        .swagger-wrapper .swagger-ui .info .title { color: #fff; }
        .swagger-wrapper .swagger-ui .info .description p { color: #9ca3af; }
        .swagger-wrapper .swagger-ui .scheme-container { background: #1f2937; border-color: #374151; }
        .swagger-wrapper .swagger-ui .opblock-tag { color: #e5e7eb; border-color: #374151; }
        .swagger-wrapper .swagger-ui .opblock .opblock-summary-description { color: #9ca3af; }
        .swagger-wrapper .swagger-ui .btn { color: #e5e7eb; }
        .swagger-wrapper .swagger-ui select { background: #374151; color: #e5e7eb; }
      `}</style>
    </div>
  );
}
