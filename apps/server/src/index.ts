import { buildServer } from './app';

const num = (v: string | undefined): number | undefined =>
  v !== undefined && v !== '' ? Number(v) : undefined;

async function main(): Promise<void> {
  const app = await buildServer({
    logger: true,
    session: {
      ...(num(process.env.TURN_BASE_MS) !== undefined && {
        turnBaseMs: num(process.env.TURN_BASE_MS) as number,
      }),
      ...(num(process.env.RESERVE_MS) !== undefined && {
        reserveMs: num(process.env.RESERVE_MS) as number,
      }),
      ...(num(process.env.RESULT_DELAY_MS) !== undefined && {
        resultDelayMs: num(process.env.RESULT_DELAY_MS) as number,
      }),
      ...(num(process.env.BOT_DELAY_MS) !== undefined && {
        botDelayMs: num(process.env.BOT_DELAY_MS) as number,
      }),
    },
  });
  const port = Number(process.env.PORT ?? 8787);
  await app.listen({ port, host: '0.0.0.0' });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
