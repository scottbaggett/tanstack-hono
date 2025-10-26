import type { Config } from "drizzle-kit";

export default {
	schema: "./src/server/db/schema.ts",
	out: "./src/server/db/migrations",
	dialect: "postgresql",
	dbCredentials: {
		url: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/workflow_builder",
	},
	migrations: {
		prefix: "timestamp",
	},
} satisfies Config;
