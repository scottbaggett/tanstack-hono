/**
 * Node Config Panel
 *
 * Side panel for configuring selected node properties
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JsonEditor } from "@/components/ui/json-editor";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { LucideIcon } from "@/components/icon/LucideIcon";
import type { Node } from "@xyflow/react";

interface NodeProperty {
	displayName: string;
	name: string;
	type: string;
	default?: unknown;
	description?: string;
}

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
	const [formValues, setFormValues] = useState<Record<string, unknown>>({});

	if (!selectedNode) {
		return null;
	}

	const nodeData = selectedNode.data as Record<string, unknown>;
	const propertyDefinitions = Array.isArray(nodeData.properties)
		? (nodeData.properties as NodeProperty[])
		: [];
	const currentProperties =
		(nodeData.propertyValues as Record<string, unknown>) || {};

	// Initialize form values from current properties
	useEffect(() => {
		const initial: Record<string, unknown> = {};
		propertyDefinitions.forEach((prop) => {
			if (typeof prop === "object" && prop !== null && "name" in prop) {
				initial[prop.name] = currentProperties[prop.name] ?? prop.default ?? "";
			}
		});
		setFormValues(initial);
	}, [selectedNode.id]);

	const handlePropertyChange = (propertyName: string, value: unknown) => {
		setFormValues((prev) => ({
			...prev,
			[propertyName]: value,
		}));
	};

	const handleSave = () => {
		onUpdateNode(selectedNode.id, {
			propertyValues: formValues,
		});
		onClose();
	};

	const handleCancel = () => {
		onClose();
	};

	return (
		<div className="w-80 bg-surface-2 border-l border-surface-6 overflow-y-auto no-scrollbar h-full flex flex-col">
			{/* Header */}
			<div className="p-4 border-b border-surface-6 flex items-center justify-between">
				<div className="flex items-center gap-2 flex-1 min-w-0">
					{typeof nodeData.icon === "string" && nodeData.icon && (
						<LucideIcon
							name={nodeData.icon}
							className="h-5 w-5 text-info-11 shrink-0"
						/>
					)}
					<div className="flex-1 min-w-0">
						<h3 className="font-semibold text-sm text-surface-12 truncate">
							{String(nodeData.displayName || nodeData.label || "")}
						</h3>
						<p className="text-xs text-surface-11">{selectedNode.id}</p>
					</div>
				</div>
				<Button
					variant="ghost"
					size="sm"
					onClick={onClose}
					className="h-6 w-6 p-0 shrink-0"
				>
					<LucideIcon name="x" className="h-4 w-4" />
				</Button>
			</div>

			{/* Properties Form */}
			<div className="flex-1 overflow-y-auto p-4 no-scrollbar">
				{propertyDefinitions.length === 0 ? (
					<div className="text-center py-8">
						<p className="text-sm text-surface-11">
							No configurable properties
						</p>
					</div>
				) : (
					<div className="space-y-4">
						{propertyDefinitions.map((prop) => {
							// Skip if not a proper property object
							if (
								typeof prop !== "object" ||
								prop === null ||
								!("name" in prop)
							) {
								return null;
							}
							const property = prop as NodeProperty;
							const currentValue =
								formValues[property.name] ?? property.default ?? "";

							// Render different input types based on property type
							const renderInput = () => {
								switch (property.type) {
									case "json": {
										return (
											<JsonEditor
												value={currentValue}
												onChange={(val) =>
													handlePropertyChange(property.name, val)
												}
												placeholder={
													typeof property.default === "object"
														? JSON.stringify(property.default, null, 2)
														: "{}"
												}
											/>
										);
									}
									case "select": {
										const options = (property as any).options || [];
										if (options.length > 0) {
											return (
												<Select
													value={String(
														currentValue || options[0]?.value || ""
													)}
													onValueChange={(val) =>
														handlePropertyChange(property.name, val)
													}
												>
													<SelectTrigger className="bg-surface-3">
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														{options.map((opt: any) => (
															<SelectItem
																key={String(opt.value)}
																value={String(opt.value)}
															>
																{opt.name}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											);
										}
										return (
											<Input
												type="text"
												value={String(currentValue)}
												onChange={(e) =>
													handlePropertyChange(property.name, e.target.value)
												}
												className="bg-surface-3 border-surface-6"
												placeholder={String(property.default || "")}
											/>
										);
									}
									case "boolean": {
										return (
											<Switch
												checked={Boolean(currentValue)}
												onCheckedChange={(checked) =>
													handlePropertyChange(property.name, checked)
												}
											/>
										);
									}
									case "number": {
										return (
											<Input
												type="number"
												value={String(currentValue)}
												onChange={(e) => {
													const numValue =
														e.target.value === "" ? 0 : Number(e.target.value);
													handlePropertyChange(property.name, numValue);
												}}
												className="bg-surface-3 border-surface-6"
												placeholder={String(property.default || "")}
											/>
										);
									}
									default: {
										return (
											<Input
												type="text"
												value={String(currentValue)}
												onChange={(e) =>
													handlePropertyChange(property.name, e.target.value)
												}
												className="bg-surface-3 border-surface-6"
												placeholder={String(property.default || "")}
											/>
										);
									}
								}
							};

							return (
								<div key={property.name} className="space-y-1">
									<label className="text-sm font-medium text-surface-12">
										{property.displayName || property.name}
									</label>
									{property.description && (
										<p className="text-xs text-surface-11">
											{property.description}
										</p>
									)}
									{renderInput()}
								</div>
							);
						})}
					</div>
				)}
			</div>

			{/* Footer */}
			<div className="p-4 border-t flex gap-2">
				<Button
					onClick={handleSave}
					className="flex-1 bg-info-9 hover:bg-info-10 text-info-1"
					size="sm"
				>
					Save
				</Button>
				<Button onClick={handleCancel} variant="outline" size="sm">
					Cancel
				</Button>
			</div>
		</div>
	);
}
