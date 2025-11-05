/**
 * Check Migration Status
 *
 * Checks if the internalTrace column exists in node_executions table
 */

import { db } from '../src/server/db';
import { sql } from 'drizzle-orm';

async function checkMigrationStatus() {
	console.log('🔍 Checking migration status...\n');

	try {
		// Check if internal_trace column exists
		const result = await db.execute(sql`
			SELECT column_name, data_type
			FROM information_schema.columns
			WHERE table_name = 'node_executions'
			AND column_name = 'internal_trace';
		`);

		const rows = Array.isArray(result) ? result : (result as any).rows || [];

		if (rows.length > 0) {
			console.log('✅ internal_trace column EXISTS in node_executions table');
			console.log('   Type:', rows[0].data_type);
			console.log('\n✅ Migration is complete! You can proceed with testing.');
		} else {
			console.log('❌ internal_trace column DOES NOT EXIST');
			console.log('\n⚠️  You need to add the column manually:');
			console.log('   ALTER TABLE node_executions ADD COLUMN internal_trace jsonb;');
		}

		// Check drizzle migrations table
		console.log('\n📋 Checking migration records...');
		const migrations = await db.execute(sql`
			SELECT hash, created_at
			FROM drizzle.__drizzle_migrations
			ORDER BY created_at DESC
			LIMIT 1;
		`);

		const migrationRows = Array.isArray(migrations) ? migrations : (migrations as any).rows || [];

		if (migrationRows.length > 0) {
			console.log('   Last migration:', migrationRows[0].hash);
			console.log('   Applied at:', migrationRows[0].created_at);
		}

		process.exit(0);
	} catch (error) {
		console.error('❌ Error checking migration status:', error);
		process.exit(1);
	}
}

checkMigrationStatus();
