import type {
	IDataObject,
	ILoadOptionsFunctions,
	INodeListSearchResult,
	INodePropertyOptions,
} from 'n8n-workflow';

import {
	frameIoApiRequest,
	frameIoApiRequestAllItems,
	getFrameIoResourceLabel,
	toFrameIoResourceOption,
} from './GenericFunctions';

const ACCOUNT_LABEL_FIELDS = ['display_name', 'name'] as const;

export async function getAccounts(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const response = await frameIoApiRequest.call(this, 'GET', '/v4/accounts');
	const accounts = (response.data as IDataObject[]) ?? [];
	return accounts.map((account) => toFrameIoResourceOption(account, ACCOUNT_LABEL_FIELDS));
}

export async function getWorkspaces(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const accountId = this.getNodeParameter('accountId', '') as string;
	if (!accountId) return [];

	const workspaces = await frameIoApiRequestAllItems.call(
		this,
		'GET',
		`/v4/accounts/${accountId}/workspaces`,
	);
	return workspaces.map((workspace) => toFrameIoResourceOption(workspace));
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
	return projects.map((project) => toFrameIoResourceOption(project));
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
	return shares.map((share) => toFrameIoResourceOption(share));
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
		.filter((share) => matchesResourceFilter(share, filter))
		.map((share) => toFrameIoResourceOption(share));

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

function matchesResourceFilter(resource: IDataObject, filter?: string): boolean {
	if (!filter) return true;
	const label = getFrameIoResourceLabel(resource);
	return (label ?? '').toLowerCase().includes(filter.toLowerCase());
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
		.filter((folder) => matchesResourceFilter(folder, filter))
		.map((folder) => toFrameIoResourceOption(folder));
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
		.filter((file) => matchesResourceFilter(file, filter))
		.map((file) => toFrameIoResourceOption(file));
}
