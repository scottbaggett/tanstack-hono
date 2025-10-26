/**
 * Node Config Panel
 *
 * Side panel for configuring selected node properties
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LucideIcon } from "@/components/icon/LucideIcon";
import type { Node } from "@xyflow/react";

interface NodeConfigPanelProps {
	selectedNode: Node | null;
	onUpdateNode: (nodeId: string, data: Record<string, unknown>) => void;
	onClose: () => void;
}

export function NodeConfigPanel({
	selectedNode,
	onUpdateNode,
	onClose,
}: NodeConfigPanelProps) {
	const [configValues, setConfigValues] = useState<Record<string, unknown>>({});

	if (!selectedNode) {
		return null;
	}

	const nodeData = selectedNode.data as Record<string, unknown>;
	const properties = (nodeData.properties || []) as Array<{
		name: string;
		displayName: string;
		description?: string;
		type: string;
		required?: boolean;
		default?: unknown;
		options?: Array<{ name: string; value: unknown }>;
		placeholder?: string;
		hint?: string;
	}>;

	const handlePropertyChange = (propertyName: string, value: unknown) => {
		setConfigValues((prev) => ({
			...prev,
			[propertyName]: value,
		}));
	};

	const handleSave = () => {
		onUpdateNode(selectedNode.id, configValues);
		setConfigValues({});
		onClose();
	};

	const handleCancel = () => {
		setConfigValues({});
		onClose();
	};

	return (
		<div
			className="w-80 bg-[var(--color-surface-2)] border-l border-[var(--color-surface-6)] overflow-y-auto h-full flex flex-col"
		>
			{/* Header */}
			<div className="p-4 border-b border-[var(--color-surface-6)] flex items-center justify-between">
				<div className="flex items-center gap-2 flex-1 min-w-0">
					{nodeData.icon && (
						<LucideIcon
							name={nodeData.icon as string}
							className="h-5 w-5 text-[var(--color-info-11)] flex-shrink-0"
						/>
					)}
					<div className="flex-1 min-w-0">
						<h3 className="font-semibold text-sm text-[var(--color-surface-12)] truncate">
							{nodeData.displayName || nodeData.label}
						</h3>
						<p className="text-xs text-[var(--color-surface-11)]">{selectedNode.id}</p>
					</div>
				</div>
				<Button
					variant="ghost"
					size="sm"
					onClick={onClose}
					className="h-6 w-6 p-0 flex-shrink-0"
				>
					<LucideIcon name="x" className="h-4 w-4" />
				</Button>
			</div>

			{/* Properties Form */}
			<div className="flex-1 overflow-y-auto p-4">
				{properties.length === 0 ? (
					<div className="text-center py-8">
						<p className="text-sm text-[var(--color-surface-11)]">
							No configurable properties
						</p>
					</div>
				) : (
					<div className="space-y-4">
						{properties.map((prop) => (
							<div key={prop.name} className="space-y-1">
								<label className="text-sm font-medium text-[var(--color-surface-12)]">
									{prop.displayName}
									{prop.required && (
										<span className="text-[var(--color-error-11)] ml-1">*</span>
									)}
								</label>
								{prop.description && (
									<p className="text-xs text-[var(--color-surface-11)]">
										{prop.description}
									</p>
								)}

								{/* String input */}
								{prop.type === "string" && (
									<Input
										type="text"
										placeholder={prop.placeholder}
										value={(configValues[prop.name] as string) || ""}
										onChange={(e) =>
											handlePropertyChange(prop.name, e.target.value)
										}
										className="bg-[var(--color-surface-3)] border-[var(--color-surface-6)]"
									/>
								)}

								{/* Number input */}
								{prop.type === "number" && (
									<Input
										type="number"
										placeholder={prop.placeholder}
										value={(configValues[prop.name] as number) || ""}
										onChange={(e) =>
											handlePropertyChange(
												prop.name,
												e.target.value ? Number(e.target.value) : ""
											)
										}
										className="bg-[var(--color-surface-3)] border-[var(--color-surface-6)]"
									/>
								)}

								{/* Boolean toggle */}
								{prop.type === "boolean" && (
									<button
										onClick={() =>
											handlePropertyChange(
												prop.name,
												!(configValues[prop.name] as boolean)
											)
										}
										className={`w-full px-3 py-2 rounded text-sm font-medium transition-colors ${
											configValues[prop.name]
												? "bg-[var(--color-info-9)] text-[var(--color-info-1)]"
												: "bg-[var(--color-surface-4)] text-[var(--color-surface-11)]"
										}`}
									>
										{(configValues[prop.name] as boolean) ? "Enabled" : "Disabled"}
									</button>
								)}

								{/* Select/options */}
								{prop.type === "options" && prop.options && (
									<select
										value={(configValues[prop.name] as string) || ""}
										onChange={(e) =>
											handlePropertyChange(prop.name, e.target.value)
										}
										className="w-full px-3 py-2 rounded bg-[var(--color-surface-3)] border border-[var(--color-surface-6)] text-sm text-[var(--color-surface-12)]"
									>
										<option value="">Select option...</option>
										{prop.options.map((opt) => (
											<option key={opt.name} value={opt.value as string}>
												{opt.name}
											</option>
										))}
									</select>
								)}

								{/* JSON editor */}
								{prop.type === "json" && (
									<textarea
										value={
											typeof configValues[prop.name] === "string"
												? (configValues[prop.name] as string)
												: JSON.stringify(configValues[prop.name] || {}, null, 2)
										}
										onChange={(e) =>
											handlePropertyChange(prop.name, e.target.value)
										}
										className="w-full px-3 py-2 rounded bg-[var(--color-surface-3)] border border-[var(--color-surface-6)] text-sm font-mono text-[var(--color-surface-12)] min-h-24"
										placeholder="{}"
									/>
								)}

								{prop.hint && (
									<p className="text-xs text-[var(--color-surface-10)] italic">
										💡 {prop.hint}
									</p>
								)}
							</div>
						))}
					</div>
				)}
			</div>

			{/* Footer */}
			<div className="p-4 border-t border-[var(--color-surface-6)] flex gap-2">
				<Button
					onClick={handleSave}
					className="flex-1 bg-[var(--color-info-9)] hover:bg-[var(--color-info-10)] text-[var(--color-info-1)]"
					size="sm"
				>
					Save
				</Button>
				<Button
					onClick={handleCancel}
					variant="outline"
					className="flex-1 border-[var(--color-surface-6)]"
					size="sm"
				>
					Cancel
				</Button>
			</div>
		</div>
	);
}
