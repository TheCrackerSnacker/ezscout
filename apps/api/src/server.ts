import { buildApp } from "./app";

const port = Number(process.env.PORT ?? 3000);

async function start(): Promise<void> {
  const app = buildApp();
  try {
    await app.listen({ port, host: "0.0.0.0" });
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

start();
