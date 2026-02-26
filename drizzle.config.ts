import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL!;
const urlObj = new URL(databaseUrl);

if (process.env.DB_USE_SSL === "true") {
  urlObj.searchParams.set("sslmode", "no-verify");
} else {
  urlObj.searchParams.set("sslmode", "disable");
}

const sanitizedLog = urlObj.toString().replace(/:([^:@]+)@/, ":****@");
console.log(`[Drizzle Config] Using sanitized URL: ${sanitizedLog}`);

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: urlObj.toString(),
  },
});
