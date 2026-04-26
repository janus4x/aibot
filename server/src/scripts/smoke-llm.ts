import { createLlmClient } from "../llm/client.js";

async function main() {
  const client = createLlmClient();
  const model = process.env.LM_STUDIO_MODEL ?? "local-model";
  const res = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: "Reply with exactly: pong" }],
    max_tokens: 16,
  });
  const text = res.choices[0]?.message?.content ?? "";
  console.log("LLM smoke OK:", text.trim());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
