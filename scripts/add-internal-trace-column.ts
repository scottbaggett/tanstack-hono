/**
 * Add internal_trace Column
 *
 * Adds the internal_trace JSONB column to node_executions table
 * This is a one-time fix since the initial migration couldn't be applied
 */

import { db } from '../src/server/db';
import { sql } from 'drizzle-orm';

async function addInternalTraceColumn() {
	console.log('🔧 Adding internal_trace column to node_executions...\n');

	try {
		// Add the column
		await db.execute(sql`
			ALTER TABLE node_executions
			ADD COLUMN IF NOT EXISTS internal_trace jsonb;
		`);

		console.log('✅ Successfully added internal_trace column!');

		// Verify it was added
		const result = await db.execute(sql`
			SELECT column_name, data_type
			FROM information_schema.columns
			WHERE table_name = 'node_executions'
			AND column_name = 'internal_trace';
		`);

		const rows = Array.isArray(result) ? result : (result as any).rows || [];

		if (rows.length > 0) {
			console.log('✅ Verified: Column exists');
			console.log('   Type:', rows[0].data_type);
			console.log('\n🎉 Migration complete! You can now test agent traceability.');
		} else {
			console.log('⚠️  Column might not have been added. Please check manually.');
		}

		process.exit(0);
	} catch (error) {
		console.error('❌ Error adding column:', error);
		console.log('\n💡 The column might already exist, which is fine!');
		process.exit(1);
	}
}

addInternalTraceColumn();
