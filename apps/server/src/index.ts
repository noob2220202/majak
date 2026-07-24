import { buildServer } from './app';

async function main(): Promise<void> {
  const app = await buildServer({ logger: true });
  const port = Number(process.env.PORT ?? 8787);
  await app.listen({ port, host: '0.0.0.0' });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
