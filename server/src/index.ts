import fs from "node:fs";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import { registerAppRoutes, resolvePublicDir } from "./http/routes.js";
import { getTaskStore } from "./store/index.js";

const PORT = Number(process.env.PORT ?? 3000);

async function main() {
  await getTaskStore();

  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: ["http://127.0.0.1:5173", "http://localhost:5173", "http://127.0.0.1:3000", "http://localhost:3000"],
  });

  await app.register(websocket);
  await app.register(multipart, {
    limits: { fileSize: 50 * 1024 * 1024 },
  });

  const publicDir = resolvePublicDir();
  if (fs.existsSync(publicDir)) {
    await app.register(fastifyStatic, {
      root: publicDir,
      prefix: "/",
    });
  }

  await registerAppRoutes(app);

  await app.listen({ port: PORT, host: "0.0.0.0" });
  app.log.info(`Server listening on http://127.0.0.1:${PORT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
