/**
 * Node Execution Detail Component
 *
 * Panel showing execution details for a node (Inputs, Outputs, Logs tabs)
 */

import { X } from "lucide-react";
import { LucideIcon } from "@/components/icon/LucideIcon";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface NodeExecutionDetailProps {
	nodeId: string;
	nodeExecution?: any;
	onClose: () => void;
}

export function NodeExecutionDetail({
	nodeId,
	nodeExecution,
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

	return (
		<div className="absolute right-0 top-0 h-full w-96 bg-background border-l shadow-lg flex flex-col">
			{/* Header */}
			<div className="flex items-center justify-between p-4 border-b">
				<div>
					<h3 className="font-semibold">{nodeExecution.nodeId}</h3>
					<p className="text-sm text-muted-foreground">{nodeExecution.nodeType}</p>
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
						<div className="space-y-2">
							<h4 className="font-medium">Input Data</h4>
							<pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-96">
								{JSON.stringify(nodeExecution.inputs || {}, null, 2)}
							</pre>
						</div>
					</TabsContent>

					<TabsContent value="outputs" className="p-4 mt-0">
						<div className="space-y-2">
							<h4 className="font-medium">Output Data</h4>
							<pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-96">
								{JSON.stringify(nodeExecution.outputs || {}, null, 2)}
							</pre>
						</div>
					</TabsContent>

					<TabsContent value="logs" className="p-4 mt-0">
						<div className="space-y-2">
							<h4 className="font-medium">Execution Logs</h4>
							<p className="text-sm text-muted-foreground">
								Logs will be available here (Phase 3)
							</p>
						</div>
					</TabsContent>
				</div>
			</Tabs>
		</div>
	);
}

