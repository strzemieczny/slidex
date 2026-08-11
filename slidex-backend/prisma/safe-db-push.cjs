const { spawnSync } = require('node:child_process');
const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const table = await client.query(
      `SELECT to_regclass('public."ChuteLane"') AS "name"`,
    );

    if (table.rows[0].name) {
      const duplicates = await client.query(`
        SELECT "code", COUNT(*)::int AS "count"
        FROM "ChuteLane"
        GROUP BY "code"
        HAVING COUNT(*) > 1
        ORDER BY "code"
      `);

      if (duplicates.rows.length > 0) {
        console.error('Cannot add ChuteLane.code uniqueness: duplicate values exist:');
        for (const row of duplicates.rows) {
          console.error(`- ${row.code}: ${row.count} rows`);
        }
        process.exitCode = 1;
        return;
      }

      await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "ChuteLane_code_key"
        ON "ChuteLane" ("code")
      `);
    }
  } finally {
    await client.end();
  }

  const prisma = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['prisma', 'db', 'push'],
    { stdio: 'inherit', env: process.env },
  );

  if (prisma.error) throw prisma.error;
  process.exitCode = prisma.status ?? 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
