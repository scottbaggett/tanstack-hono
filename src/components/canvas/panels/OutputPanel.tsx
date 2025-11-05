/**
 * Output Panel
 *
 * Execute node and display results with Schema/Table/JSON views
 */

import { useState } from "react";
import { SchemaTree } from "./SchemaTree";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface OutputPanelProps {
	executionResult: any;
}

type ViewMode = "schema" | "table" | "json";

export function OutputPanel({ executionResult }: OutputPanelProps) {
	const [viewMode, setViewMode] = useState<ViewMode>("schema");

	// Extract json data and error from execution result
	// executionResult is { json: {...}, binary: {...} } or { error: {...} }
	const jsonData = executionResult?.json || null;
	const errorData = executionResult?.error || null;

	const hasData = jsonData && typeof jsonData === "object";
	const hasError = errorData && typeof errorData === "object";

	return (
		<div className="flex flex-col h-full">
			{/* Header with Tabs */}
			<div className="px-4 pt-4 pb-2 border-b border-surface-6">
				<div className="flex items-center justify-between mb-3">
					<h3 className="font-semibold text-sm text-surface-11 uppercase tracking-wide">
						OUTPUT
					</h3>
					{hasData && (
						<Tabs
							value={viewMode}
							onValueChange={(v) => setViewMode(v as ViewMode)}
							className="w-auto"
						>
							<TabsList className="h-8">
								<TabsTrigger value="schema" className="text-xs px-3">
									Schema
								</TabsTrigger>
								<TabsTrigger value="table" className="text-xs px-3">
									Table
								</TabsTrigger>
								<TabsTrigger value="json" className="text-xs px-3">
									JSON
								</TabsTrigger>
							</TabsList>
						</Tabs>
					)}
				</div>
			</div>

			{/* Content */}
			<div className="flex-1 overflow-y-auto">
				{hasError ? (
					<div className="flex flex-col items-start px-4 py-4">
						<div className="w-full space-y-3">
							<div className="flex items-center gap-2">
								<div className="w-2 h-2 rounded-full bg-red-9" />
								<p className="text-sm text-red-11 font-semibold">
									Execution Error
								</p>
							</div>
							<div className="bg-red-2 border border-red-6 rounded p-4">
								<p className="text-sm text-red-12 font-semibold">
									{errorData.message}
								</p>
							</div>
							{errorData.stack && (
								<details className="w-full">
									<summary className="text-xs text-surface-11 cursor-pointer hover:text-surface-12 font-medium">
										View stack trace
									</summary>
									<pre className="text-xs text-surface-11 mt-3 p-3 bg-surface-3 rounded overflow-x-auto whitespace-pre-wrap font-mono border border-surface-6">
										{errorData.stack}
									</pre>
								</details>
							)}
						</div>
					</div>
				) : !hasData ? (
					<div className="flex flex-col items-center justify-center h-full px-4">
						<div className="text-center">
							<p className="text-sm text-surface-11 font-semibold">
								Execute this node to view output
							</p>
							<p className="text-xs text-surface-10 mt-2">
								Results will appear here
							</p>
						</div>
					</div>
				) : (
					<div className="py-2">
						{/* Schema View */}
						{viewMode === "schema" && (
							<div className="px-2">
								<SchemaTree data={jsonData} path="json" />
							</div>
						)}

						{/* Table View */}
						{viewMode === "table" && (
							<div className="px-4">
								<div className="overflow-x-auto">
									<table className="w-full text-xs border-collapse">
										<thead>
											<tr className="border-b border-surface-6">
												<th className="text-left py-2 px-2 font-semibold text-surface-11 bg-surface-2">
													Key
												</th>
												<th className="text-left py-2 px-2 font-semibold text-surface-11 bg-surface-2">
													Value
												</th>
												<th className="text-left py-2 px-2 font-semibold text-surface-11 bg-surface-2">
													Type
												</th>
											</tr>
										</thead>
										<tbody>
											{Object.entries(jsonData).map(([key, value]) => {
												const valueType = Array.isArray(value)
													? "array"
													: value === null
														? "null"
														: typeof value;
												const displayValue =
													typeof value === "object" && value !== null
														? JSON.stringify(value)
														: String(value);

												return (
													<tr
														key={key}
														className="border-b border-surface-5 hover:bg-surface-2"
														draggable
														onDragStart={(e) => {
															const path = `{{ json.${key} }}`;
															e.dataTransfer.setData("text/plain", path);
														}}
													>
														<td className="py-2 px-2 font-medium text-surface-12 cursor-grab">
															{key}
														</td>
														<td className="py-2 px-2 text-surface-11 max-w-xs truncate">
															{displayValue}
														</td>
														<td className="py-2 px-2 text-surface-10">
															<span className="px-2 py-0.5 bg-surface-3 rounded">
																{valueType}
															</span>
														</td>
													</tr>
												);
											})}
										</tbody>
									</table>
								</div>
							</div>
						)}

						{/* JSON View */}
						{viewMode === "json" && (
							<div className="px-4">
								<pre className="text-xs bg-surface-3 p-3 rounded overflow-x-auto">
									{JSON.stringify(jsonData, null, 2)}
								</pre>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
