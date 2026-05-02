import { testEnvironment } from "../src/adapters/local-llm/test.ts";
const r = await testEnvironment({ companyId: "x", adapterType: "local_llm", config: { model: "qwen3:14b" } });
console.log(JSON.stringify(r, null, 2));
