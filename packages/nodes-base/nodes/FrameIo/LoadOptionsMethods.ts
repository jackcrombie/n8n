import type {
	FieldType,
	IDataObject,
	ILoadOptionsFunctions,
	INodeListSearchItems,
	INodeListSearchResult,
	INodePropertyOptions,
	ResourceMapperField,
	ResourceMapperFields,
} from 'n8n-workflow';

import {
	getFieldSelectOptions,
	toFieldDefinition,
	type FrameIoFieldDefinition,
} from './FrameIoMetadataHelpers';
import {
	extractResourceLocatorValue,
	frameIoApiRequest,
	frameIoApiRequestAllItems,
	getFrameIoResourceLabel,
	toFrameIoResourceOption,
} from './GenericFunctions';

const ACCOUNT_LABEL_FIELDS = ['display_name', 'name'] as const;

async function listFieldDefinitions(
	this: ILoadOptionsFunctions,
	accountId: string,
): Promise<FrameIoFieldDefinition[]> {
	const fields = await frameIoApiRequestAllItems.call(
		this,
		'GET',
		`/v4/accounts/${accountId}/metadata/field_definitions`,
		'data',
		{
			filters: {
				exclude_immutable: true,
				exclude_inactive: true,
			},
		},
	);
	return fields.map((field) => toFieldDefinition(field));
}

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

/** n8n input type for each Frame.io field type; multi-select takes comma-separated names. */
function toMapperFieldType(field: FrameIoFieldDefinition): FieldType {
	switch (field.field_type) {
		case 'select':
			return 'options';
		case 'number':
		case 'rating':
			return 'number';
		case 'toggle':
			return 'boolean';
		case 'date':
			return 'dateTime';
		default:
			return 'string';
	}
}

export async function getMetadataFields(
	this: ILoadOptionsFunctions,
): Promise<ResourceMapperFields> {
	const accountId = this.getNodeParameter('accountId', '') as string;
	if (!accountId) return { fields: [] };

	const definitions = await listFieldDefinitions.call(this, accountId);
	const fields: ResourceMapperField[] = definitions.map((field) => {
		const type = toMapperFieldType(field);
		return {
			id: field.id,
			displayName: field.name,
			required: false,
			defaultMatch: false,
			canBeUsedToMatch: false,
			display: true,
			type,
			...(type === 'options'
				? {
						// Option names are resolved to IDs at execution time, so names work in expressions too.
						options: getFieldSelectOptions(field).map((option) => ({
							name: option.display_name,
							value: option.display_name,
						})),
					}
				: {}),
		};
	});
	return { fields };
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
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	return await walkProjectTree.call(this, 'folders', filter, paginationToken);
}

export async function searchFiles(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	return await walkProjectTree.call(this, 'files', filter, paginationToken);
}

/** Folders inside the share selected in the same Filter route. */
export async function searchShareFolders(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const accountId = this.getNodeParameter('accountId', '') as string;
	const shareId = extractResourceLocatorValue(
		this.getCurrentNodeParameter('&share') as string | { value?: string } | undefined,
	);
	if (!accountId || !shareId) return { results: [] };

	const assets = await frameIoApiRequestAllItems.call(
		this,
		'GET',
		`/v4/accounts/${accountId}/shares/${shareId}/assets`,
	);
	const results = assets
		.filter((asset) => asset.type === 'folder' && matchesResourceFilter(asset, filter))
		.map((folder) => toFrameIoResourceOption(folder));
	return { results };
}

function matchesResourceFilter(resource: IDataObject, filter?: string): boolean {
	return matchesText(getFrameIoResourceLabel(resource) ?? '', filter);
}

function matchesText(text: string, filter?: string): boolean {
	if (!filter) return true;
	return text.toLowerCase().includes(filter.toLowerCase());
}

interface TreeCursor {
	id: string;
	path: string;
}

/** Bounds each page so a large project never blocks the picker on one request. */
const MAX_FOLDERS_PER_PAGE = 15;
const TARGET_RESULTS_PER_PAGE = 50;

function isTreeCursor(value: unknown): value is TreeCursor {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as TreeCursor).id === 'string' &&
		typeof (value as TreeCursor).path === 'string'
	);
}

function parseTreeCursor(token?: string): TreeCursor[] | undefined {
	if (!token) return undefined;
	try {
		const parsed: unknown = JSON.parse(token);
		return Array.isArray(parsed) && parsed.every(isTreeCursor) ? parsed : undefined;
	} catch {
		return undefined;
	}
}

function joinPath(parent: string, label: string): string {
	return parent ? `${parent} / ${label}` : label;
}

/**
 * Breadth-first walk of a project's folder tree. Frame.io has no search endpoint, so
 * folders still to visit travel in the pagination token and the picker loads more on scroll.
 */
async function walkProjectTree(
	this: ILoadOptionsFunctions,
	collect: 'folders' | 'files',
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	const accountId = this.getNodeParameter('accountId', '') as string;
	const projectId = this.getNodeParameter('projectId', '') as string;
	if (!accountId || !projectId) return { results: [] };

	let queue = parseTreeCursor(paginationToken);
	if (!queue) {
		const project = await frameIoApiRequest.call(
			this,
			'GET',
			`/v4/accounts/${accountId}/projects/${projectId}`,
		);
		const projectData = (project.data as IDataObject) ?? project;
		const rootFolderId = projectData.root_folder_id as string | undefined;
		if (!rootFolderId) return { results: [] };
		queue = [{ id: rootFolderId, path: '' }];
	}

	const results: INodeListSearchItems[] = [];
	let visited = 0;
	while (
		queue.length > 0 &&
		visited < MAX_FOLDERS_PER_PAGE &&
		results.length < TARGET_RESULTS_PER_PAGE
	) {
		const current = queue.shift() as TreeCursor;
		visited++;

		const subfolders = await frameIoApiRequestAllItems.call(
			this,
			'GET',
			`/v4/accounts/${accountId}/folders/${current.id}/folders`,
		);
		for (const folder of subfolders) {
			const id = folder.id as string;
			const path = joinPath(current.path, getFrameIoResourceLabel(folder) ?? id);
			queue.push({ id, path });
			if (collect === 'folders' && matchesText(path, filter)) {
				results.push({ name: path, value: id, description: id });
			}
		}

		if (collect === 'files') {
			const files = await frameIoApiRequestAllItems.call(
				this,
				'GET',
				`/v4/accounts/${accountId}/folders/${current.id}/files`,
			);
			for (const file of files) {
				const id = file.id as string;
				const path = joinPath(current.path, getFrameIoResourceLabel(file) ?? id);
				if (matchesText(path, filter)) results.push({ name: path, value: id, description: id });
			}
		}
	}

	return {
		results,
		paginationToken: queue.length > 0 ? JSON.stringify(queue) : undefined,
	};
}
