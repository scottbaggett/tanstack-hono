/**
 * Credentials Management Page
 *
 * List, create, edit, and delete credentials
 */

import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { LucideIcon } from '@/components/icon/LucideIcon';
import { CredentialModal } from '@/components/credentials/CredentialModal';
import type { ICredentialsResponse } from '@/types/credentials';

export const Route = createFileRoute('/credentials')({
	component: CredentialsPage,
});

function CredentialsPage() {
	const [credentials, setCredentials] = useState<ICredentialsResponse[]>([]);
	const [loading, setLoading] = useState(true);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingCredential, setEditingCredential] = useState<string | null>(null);

	// Fetch credentials
	const fetchCredentials = async () => {
		try {
			setLoading(true);
			const response = await fetch('/api/credentials');
			const data = await response.json();

			if (data.success) {
				setCredentials(data.data);
			}
		} catch (error) {
			console.error('Failed to fetch credentials:', error);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchCredentials();
	}, []);

	// Delete credential
	const handleDelete = async (id: string, name: string) => {
		if (!confirm(`Are you sure you want to delete "${name}"?`)) {
			return;
		}

		try {
			const response = await fetch(`/api/credentials/${id}`, {
				method: 'DELETE',
			});

			const data = await response.json();

			if (data.success) {
				// Refresh list
				fetchCredentials();
			} else {
				alert('Failed to delete credential');
			}
		} catch (error) {
			console.error('Failed to delete credential:', error);
			alert('Failed to delete credential');
		}
	};

	// Open modal for creating new credential
	const handleCreate = () => {
		setEditingCredential(null);
		setIsModalOpen(true);
	};

	// Open modal for editing existing credential
	const handleEdit = (id: string) => {
		setEditingCredential(id);
		setIsModalOpen(true);
	};

	// Handle modal close and refresh
	const handleModalClose = (saved: boolean) => {
		setIsModalOpen(false);
		setEditingCredential(null);

		if (saved) {
			fetchCredentials();
		}
	};

	// Format date
	const formatDate = (dateString: string) => {
		const date = new Date(dateString);
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		}).format(date);
	};

	// Get credential type display info
	const getTypeInfo = (type: string) => {
		const typeMap: Record<string, { icon: string; color: string }> = {
			httpBasicAuth: { icon: 'lock', color: 'text-blue-11' },
			apiKey: { icon: 'key', color: 'text-green-11' },
			bearerToken: { icon: 'shield', color: 'text-purple-11' },
		};

		return typeMap[type] || { icon: 'key', color: 'text-surface-11' };
	};

	if (loading) {
		return (
			<div className="min-h-screen bg-surface-1 flex items-center justify-center">
				<div className="text-surface-11">Loading credentials...</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-surface-1">
			{/* Header */}
			<div className="border-b border-surface-6 bg-surface-2">
				<div className="max-w-6xl mx-auto px-6 py-6">
					<div className="flex items-center justify-between">
						<div>
							<h1 className="text-2xl font-semibold text-surface-12">
								Credentials
							</h1>
							<p className="text-sm text-surface-11 mt-1">
								Manage API keys, tokens, and authentication for your workflows
							</p>
						</div>
						<Button onClick={handleCreate}>
							<LucideIcon name="plus" className="w-4 h-4 mr-2" />
							New Credential
						</Button>
					</div>
				</div>
			</div>

			{/* Content */}
			<div className="max-w-6xl mx-auto px-6 py-8">
				{credentials.length === 0 ? (
					<div className="text-center py-16">
						<LucideIcon
							name="key"
							className="w-12 h-12 text-surface-8 mx-auto mb-4"
						/>
						<h2 className="text-lg font-medium text-surface-11 mb-2">
							No credentials yet
						</h2>
						<p className="text-sm text-surface-10 mb-6">
							Create your first credential to start authenticating with external
							services
						</p>
						<Button onClick={handleCreate}>
							<LucideIcon name="plus" className="w-4 h-4 mr-2" />
							Create Credential
						</Button>
					</div>
				) : (
					<div className="grid gap-4">
						{credentials.map((credential) => {
							const typeInfo = getTypeInfo(credential.type);

							return (
								<div
									key={credential.id}
									className="bg-surface-2 border border-surface-6 rounded-lg p-6 hover:border-surface-7 transition-colors"
								>
									<div className="flex items-start justify-between">
										<div className="flex items-start gap-4 flex-1">
											<div
												className={`p-3 rounded-lg bg-surface-3 ${typeInfo.color}`}
											>
												<LucideIcon name={typeInfo.icon} className="w-5 h-5" />
											</div>

											<div className="flex-1 min-w-0">
												<div className="flex items-center gap-3 mb-1">
													<h3 className="text-lg font-medium text-surface-12">
														{credential.name}
													</h3>
													<span className="text-xs px-2 py-1 rounded bg-surface-4 text-surface-11">
														{credential.type}
													</span>
												</div>

												<div className="flex items-center gap-4 text-sm text-surface-10">
													<span>
														Created {formatDate(credential.createdAt)}
													</span>
													{credential.updatedAt !== credential.createdAt && (
														<span>
															Updated {formatDate(credential.updatedAt)}
														</span>
													)}
												</div>
											</div>
										</div>

										<div className="flex items-center gap-2">
											<Button
												variant="ghost"
												size="sm"
												onClick={() => handleEdit(credential.id)}
											>
												<LucideIcon name="edit" className="w-4 h-4 mr-2" />
												Edit
											</Button>
											<Button
												variant="ghost"
												size="sm"
												onClick={() =>
													handleDelete(credential.id, credential.name)
												}
												className="text-red-11 hover:bg-red-3"
											>
												<LucideIcon name="trash-2" className="w-4 h-4" />
											</Button>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>

			{/* Modal */}
			{isModalOpen && (
				<CredentialModal
					credentialId={editingCredential}
					onClose={handleModalClose}
				/>
			)}
		</div>
	);
}
