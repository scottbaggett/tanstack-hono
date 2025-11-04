/**
 * Parameters Panel
 *
 * Node configuration form with drag-drop support for inputs
 */

import React from "react";
import type { Node } from "@xyflow/react";
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
import { CredentialSelector } from "./CredentialSelector";

interface NodeProperty {
	displayName: string;
	name: string;
	type: string;
	default?: unknown;
	description?: string;
}

interface CredentialRequirement {
	name: string;
	required?: boolean;
}

interface ParametersPanelProps {
	selectedNode: Node;
	onUpdateNode: (nodeId: string, data: Record<string, unknown>) => void;
	nodeRegistry: any;
	currentPropertyValues: Record<string, unknown>;
	onPropertyValuesChange: (values: Record<string, unknown>) => void;
}

export function ParametersPanel({
	selectedNode,
	onUpdateNode,
	nodeRegistry,
	currentPropertyValues,
	onPropertyValuesChange,
}: ParametersPanelProps) {
	const nodeData = selectedNode.data as Record<string, unknown>;
	const nodeId = nodeData.nodeId as string;

	// Look up property and credential definitions from registry
	const registryNode = nodeRegistry?.nodes?.find((n: any) => n.id === nodeId);
	const propertyDefinitions = Array.isArray(registryNode?.properties)
		? (registryNode.properties as NodeProperty[])
		: [];
	const credentialRequirements = Array.isArray(registryNode?.credentials)
		? (registryNode.credentials as CredentialRequirement[])
		: [];

	// Get current credentials from node data
	const currentCredentials =
		(nodeData.credentials as Record<string, { id: string; name: string }>) ||
		{};

	const handlePropertyChange = (propertyName: string, value: unknown) => {
		onPropertyValuesChange({
			...currentPropertyValues,
			[propertyName]: value,
		});
	};

	const handleCredentialChange = (
		credentialType: string,
		credential: { id: string; name: string } | null
	) => {
		const updatedCredentials = { ...currentCredentials };

		if (credential) {
			updatedCredentials[credentialType] = credential;
		} else {
			delete updatedCredentials[credentialType];
		}

		// Update node data directly (not part of property values)
		onUpdateNode(selectedNode.id, {
			...selectedNode.data,
			credentials: updatedCredentials,
		});
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
	};

	const handleDrop = (e: React.DragEvent, fieldName: string) => {
		e.preventDefault();
		const expression = e.dataTransfer.getData("text/plain");
		console.log("Dropped:", expression, "on", fieldName);
		if (expression) {
			handlePropertyChange(fieldName, expression);
		}
	};

	const hasCredentials = credentialRequirements.length > 0;
	const hasProperties = propertyDefinitions.length > 0;

	if (!hasCredentials && !hasProperties) {
		return (
			<div className="p-4">
				<div className="text-center py-8">
					<p className="text-sm text-surface-11">No configuration required</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full p-4">
			<div className="flex-1 overflow-y-auto space-y-6 mb-4 no-scrollbar">
				{/* Credentials Section */}
				{hasCredentials && (
					<div className="space-y-4">
						<div>
							<h3 className="text-lg font-semibold">Credentials</h3>
							<p className="text-xs text-surface-11 mt-1">
								Authentication for this node
							</p>
						</div>

						{credentialRequirements.map((credReq) => {
							const credential = currentCredentials[credReq.name];

							return (
								<div key={credReq.name} className="space-y-2">
									<label className="text-sm font-medium text-surface-12">
										{credReq.name}
										{credReq.required && (
											<span className="text-red-9 ml-1">*</span>
										)}
									</label>
									<CredentialSelector
										credentialType={credReq.name}
										value={credential || null}
										onChange={(cred) =>
											handleCredentialChange(credReq.name, cred)
										}
										required={credReq.required}
									/>
								</div>
							);
						})}
					</div>
				)}

				{/* Parameters Section */}
				{hasProperties && (
					<div className="space-y-4">
						{hasCredentials && (
							<div className="border-t border-surface-6 pt-6">
								<h3 className="text-lg font-semibold mb-4">Parameters</h3>
							</div>
						)}
						{!hasCredentials && (
							<h3 className="text-lg font-semibold mb-4">Parameters</h3>
						)}

						{propertyDefinitions.map((prop) => {
							if (
								typeof prop !== "object" ||
								prop === null ||
								!("name" in prop)
							) {
								return null;
							}

							const property = prop as NodeProperty;
							const currentValue =
								currentPropertyValues[property.name] ?? property.default ?? "";

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
										// For select type, check if property has options
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
										// Fall through to text input if no options
										return (
											<Input
												type="text"
												value={String(currentValue)}
												onChange={(e) =>
													handlePropertyChange(property.name, e.target.value)
												}
												onDragOver={handleDragOver}
												onDrop={(e) => handleDrop(e, property.name)}
												placeholder={String(property.default || "")}
												className="bg-surface-3"
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
												onDragOver={handleDragOver}
												onDrop={(e) => handleDrop(e, property.name)}
												placeholder={String(property.default || "")}
												className="bg-surface-3"
											/>
										);
									}
									default: {
										// Default to text input
										return (
											<Input
												type="text"
												value={String(currentValue)}
												onChange={(e) =>
													handlePropertyChange(property.name, e.target.value)
												}
												onDragOver={handleDragOver}
												onDrop={(e) => handleDrop(e, property.name)}
												placeholder={String(property.default || "")}
												className="bg-surface-3"
											/>
										);
									}
								}
							};

							return (
								<div key={property.name} className="space-y-2">
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
		</div>
	);
}
