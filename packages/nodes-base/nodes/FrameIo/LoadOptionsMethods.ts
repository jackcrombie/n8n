import type {
	IDataObject,
	ILoadOptionsFunctions,
	INodeListSearchResult,
	INodePropertyOptions,
} from 'n8n-workflow';

import { frameIoApiRequest, frameIoApiRequestAllItems } from './GenericFunctions';

export async function getAccounts(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const response = await frameIoApiRequest.call(this, 'GET', '/v4/accounts');
	const accounts = (response.data as IDataObject[]) ?? [];
	return accounts.map((account) => ({
		name: (account.name as string) ?? (account.id as string),
		value: account.id as string,
	}));
}

export async function getWorkspaces(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const accountId = this.getNodeParameter('accountId', '') as string;
	if (!accountId) return [];

	const workspaces = await frameIoApiRequestAllItems.call(
		this,
		'GET',
		`/v4/accounts/${accountId}/workspaces`,
	);
	return workspaces.map((workspace) => ({
		name: (workspace.name as string) ?? (workspace.id as string),
		value: workspace.id as string,
	}));
}

export async function getProjects(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const accountId = this.getNodeParameter('accountId', '') as string;
	const workspaceId = this.getNodeParameter('workspaceId', '') as string;
	if (!accountId || !workspaceId) return [];

	const projects = await frameIoApiRequestAllItems.call(
		this,
		'GET',
		`/v4/accounts/${accountId}/workspaces/${workspaceId}/projects`,
	);
	return projects.map((project) => ({
		name: (project.name as string) ?? (project.id as string),
		value: project.id as string,
	}));
}

export async function getShares(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const accountId = this.getNodeParameter('accountId', '') as string;
	const projectId = this.getNodeParameter('projectId', '') as string;
	if (!accountId || !projectId) return [];

	const shares = await frameIoApiRequestAllItems.call(
		this,
		'GET',
		`/v4/accounts/${accountId}/projects/${projectId}/shares`,
	);
	return shares.map((share) => ({
		name: (share.name as string) ?? (share.id as string),
		value: share.id as string,
	}));
}

export async function searchShares(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const accountId = this.getNodeParameter('accountId', '') as string;
	const projectId = this.getNodeParameter('projectId', '') as string;
	if (!accountId || !projectId) {
		return { results: [] };
	}

	const shares = await frameIoApiRequestAllItems.call(
		this,
		'GET',
		`/v4/accounts/${accountId}/projects/${projectId}/shares`,
	);

	const results = shares
		.filter((share) => {
			if (!filter) return true;
			const name = (share.name as string) ?? '';
			return name.toLowerCase().includes(filter.toLowerCase());
		})
		.map((share) => ({
			name: (share.name as string) ?? (share.id as string),
			value: share.id as string,
		}));

	return { results };
}

export async function searchFolders(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const options = await searchFolderOptions.call(this, filter);
	return { results: options };
}

export async function searchFiles(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const options = await searchFileOptions.call(this, filter);
	return { results: options };
}

async function searchFolderOptions(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodePropertyOptions[]> {
	const accountId = this.getNodeParameter('accountId', '') as string;
	const projectId = this.getNodeParameter('projectId', '') as string;
	if (!accountId || !projectId) return [];

	const project = await frameIoApiRequest.call(
		this,
		'GET',
		`/v4/accounts/${accountId}/projects/${projectId}`,
	);
	const projectData = (project.data as IDataObject) ?? project;
	const rootFolderId = projectData.root_folder_id as string;
	if (!rootFolderId) return [];

	const folders = await frameIoApiRequestAllItems.call(
		this,
		'GET',
		`/v4/accounts/${accountId}/folders/${rootFolderId}/folders`,
	);

	return folders
		.filter((folder) => {
			if (!filter) return true;
			const name = (folder.name as string) ?? '';
			return name.toLowerCase().includes(filter.toLowerCase());
		})
		.map((folder) => ({
			name: (folder.name as string) ?? (folder.id as string),
			value: folder.id as string,
		}));
}

async function searchFileOptions(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodePropertyOptions[]> {
	const accountId = this.getNodeParameter('accountId', '') as string;
	const projectId = this.getNodeParameter('projectId', '') as string;
	if (!accountId || !projectId) return [];

	const project = await frameIoApiRequest.call(
		this,
		'GET',
		`/v4/accounts/${accountId}/projects/${projectId}`,
	);
	const projectData = (project.data as IDataObject) ?? project;
	const rootFolderId = projectData.root_folder_id as string;
	if (!rootFolderId) return [];

	const files = await frameIoApiRequestAllItems.call(
		this,
		'GET',
		`/v4/accounts/${accountId}/folders/${rootFolderId}/files`,
	);

	return files
		.filter((file) => {
			if (!filter) return true;
			const name = (file.name as string) ?? '';
			return name.toLowerCase().includes(filter.toLowerCase());
		})
		.map((file) => ({
			name: (file.name as string) ?? (file.id as string),
			value: file.id as string,
		}));
}
