import { Client } from "pg";

async function bootstrap() {
  const targetUrl = process.env.DATABASE_URL;
  const maintenanceDb = process.env.MAINTENANCE_DB;

  if (!targetUrl) {
    console.error("DATABASE_URL is missing!");
    process.exit(1);
  }

  if (!maintenanceDb) {
    console.error(
      "MAINTENANCE_DB is missing! Please set it in your environment (e.g., MAINTENANCE_DB=postgres)",
    );
    process.exit(1);
  }


  const useSsl = process.env.DB_USE_SSL === "true";
  const sslConfig = useSsl ? { rejectUnauthorized: false } : false;

  const urlObj = new URL(targetUrl);
  const targetDbName = urlObj.pathname.split("/")[1];


  urlObj.pathname = `/${maintenanceDb}`;
  const maintenanceUrl = urlObj.toString();

  console.log(
    `Connecting to administrative DB "${maintenanceDb}" to check for "${targetDbName}"...`,
  );

  const maintenanceClient = new Client({
    connectionString: maintenanceUrl,
    ssl: sslConfig,
  });

  try {
    await maintenanceClient.connect();

    const checkRes = await maintenanceClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [targetDbName],
    );

    if (checkRes.rowCount === 0) {
      console.log(`Database "${targetDbName}" missing. Creating it...`);
      await maintenanceClient.query(`CREATE DATABASE "${targetDbName}"`);
      console.log(`Database "${targetDbName}" created successfully!`);
    } else {
      console.log(`Database "${targetDbName}" already exists.`);
    }
  } catch (err) {
    console.error("Bootstrap DB creation failed:", err);
    process.exit(1);
  } finally {
    await maintenanceClient.end();
  }

  console.log(`Installing required extensions in "${targetDbName}"...`);

  const targetUrlObj = new URL(targetUrl);

  const targetClient = new Client({
    connectionString: targetUrlObj.toString(),
    ssl: sslConfig,
  });

  try {
    await targetClient.connect();

    await targetClient.query("CREATE EXTENSION IF NOT EXISTS vector;");
    console.log("✓ vector extension installed");

    await targetClient.query("CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;");
    console.log("✓ fuzzystrmatch extension installed");

    await targetClient.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
    console.log("✓ pg_trgm extension installed");

    console.log(`Bootstrap completed successfully!`);
  } catch (err) {
    console.error("Extension installation failed:", err);
    process.exit(1);
  } finally {
    await targetClient.end();
  }
}

bootstrap();
