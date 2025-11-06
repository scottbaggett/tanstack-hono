/**
 * Node Execution Detail Component
 *
 * Panel showing execution details for a node (Inputs, Outputs, Logs tabs)
 */

import { X } from "lucide-react";
import { useState } from "react";
import { LucideIcon } from "@/components/icon/LucideIcon";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ExecutionLogsViewer } from "./ExecutionLogsViewer";
import type { NodeExecution } from "@/server/types/api";
import type { INodeExecutionStatus } from "@/types/interfaces";

interface NodeExecutionDetailProps {
	nodeId: string;
	nodeExecution?: NodeExecution;
	runId?: string;
	workflowId?: string;
	onClose: () => void;
}

const MAX_LINES = 50;

function JsonViewer({ data, title }: { data: unknown; title: string }) {
	const [isExpanded, setIsExpanded] = useState(false);
	const jsonString = JSON.stringify(data, null, 2);
	const lines = jsonString.split("\n");
	const isLarge = lines.length > MAX_LINES;
	const displayLines = isExpanded ? lines : lines.slice(0, MAX_LINES);
	const displayText = displayLines.join("\n");

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(jsonString);
		} catch (err) {
			console.error("Failed to copy:", err);
		}
	};

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between">
				<h4 className="font-medium">{title}</h4>
				<div className="flex items-center gap-2">
					{isLarge && (
						<Badge variant="outline" className="text-xs">
							{lines.length} lines
						</Badge>
					)}
					<Button
						variant="ghost"
						size="sm"
						onClick={handleCopy}
						className="h-7 px-2"
					>
						<LucideIcon name="copy" className="h-3 w-3 mr-1" />
						Copy
					</Button>
				</div>
			</div>
			<div className="relative">
				<pre className="text-xs bg-muted p-3 rounded overflow-auto font-mono">
					{displayText}
					{!isExpanded && isLarge && (
						<span className="text-muted-foreground">{"\n"}... (truncated)</span>
					)}
				</pre>
				{isLarge && (
					<Button
						variant="ghost"
						size="sm"
						onClick={() => setIsExpanded(!isExpanded)}
						className="absolute bottom-2 right-2 bg-background/80 hover:bg-background"
					>
						<LucideIcon
							name={isExpanded ? "chevron-up" : "chevron-down"}
							className="h-4 w-4 mr-1"
						/>
						{isExpanded ? "Collapse" : "Expand Full"}
					</Button>
				)}
			</div>
		</div>
	);
}

export function NodeExecutionDetail({
	nodeId,
	nodeExecution,
	runId,
	workflowId,
	onClose,
}: NodeExecutionDetailProps) {
	if (!nodeExecution) {
		return (
			<div className="absolute right-0 top-0 h-full w-96 bg-background border-l shadow-lg flex flex-col">
				<div className="flex items-center justify-between p-4 border-b">
					<h3 className="font-semibold">Node Execution</h3>
					<Button variant="ghost" size="sm" onClick={onClose}>
						<X className="h-4 w-4" />
					</Button>
				</div>
				<div className="flex-1 p-4">
					<p className="text-muted-foreground">No execution data available</p>
				</div>
			</div>
		);
	}

	const statusConfig: Record<
		INodeExecutionStatus,
		{ label: string; variant: "default" | "secondary" | "destructive" }
	> = {
		pending: { label: "Pending", variant: "secondary" },
		running: { label: "Running", variant: "default" },
		completed: { label: "Completed", variant: "default" },
		failed: { label: "Failed", variant: "destructive" },
		skipped: { label: "Skipped", variant: "secondary" },
	};

	const status = statusConfig[nodeExecution.status] || statusConfig.pending;

	return (
		<div className="absolute right-0 top-0 h-full w-96 bg-background border-l shadow-lg flex flex-col">
			{/* Header */}
			<div className="flex items-center justify-between p-4 border-b">
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-1">
						<h3 className="font-semibold truncate">{nodeExecution.nodeId}</h3>
						<Badge variant={status.variant} className="text-xs shrink-0">
							{status.label}
						</Badge>
					</div>
					<p className="text-sm text-muted-foreground">{nodeExecution.nodeType}</p>
					{nodeExecution.errorMessage && (
						<p className="text-sm text-destructive mt-1">
							{nodeExecution.errorMessage}
						</p>
					)}
					{nodeExecution.tokensUsed && (
						<p className="text-xs text-muted-foreground mt-1">
							<LucideIcon name="zap" className="h-3 w-3 inline mr-1" />
							{nodeExecution.tokensUsed.toLocaleString()} tokens
						</p>
					)}
				</div>
				<Button variant="ghost" size="sm" onClick={onClose}>
					<X className="h-4 w-4" />
				</Button>
			</div>

			{/* Tabs */}
			<Tabs defaultValue="inputs" className="flex-1 flex flex-col overflow-hidden">
				<TabsList className="mx-4 mt-4">
					<TabsTrigger value="inputs">Inputs</TabsTrigger>
					<TabsTrigger value="outputs">Outputs</TabsTrigger>
					<TabsTrigger value="logs">Logs</TabsTrigger>
				</TabsList>

				<div className="flex-1 overflow-auto">
					<TabsContent value="inputs" className="p-4 mt-0">
						<JsonViewer data={nodeExecution.inputs || {}} title="Input Data" />
					</TabsContent>

					<TabsContent value="outputs" className="p-4 mt-0">
						<JsonViewer data={nodeExecution.outputs || {}} title="Output Data" />
					</TabsContent>

					<TabsContent value="logs" className="p-4 mt-0 h-full">
						{runId && workflowId ? (
							<ExecutionLogsViewer
								workflowId={workflowId}
								runId={runId}
								nodeId={nodeId}
							/>
						) : (
							<div className="space-y-2">
								<h4 className="font-medium">Execution Logs</h4>
								<p className="text-sm text-muted-foreground">
									Logs will be available here (runId or workflowId missing)
								</p>
							</div>
						)}
					</TabsContent>
				</div>
			</Tabs>
		</div>
	);
}

