ALTER TABLE "node_executions" ADD COLUMN "stage" integer;--> statement-breakpoint
CREATE INDEX "node_executions_stage_idx" ON "node_executions" USING btree ("stage");