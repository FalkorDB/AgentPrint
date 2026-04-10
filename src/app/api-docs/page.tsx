import { getApiDocs } from "@/lib/swagger";
import ReactSwagger from "./react-swagger";

export default async function ApiDocsPage() {
  const spec = getApiDocs();
  return (
    <main className="max-w-7xl mx-auto px-6 py-8">
      <ReactSwagger spec={spec} />
    </main>
  );
}
