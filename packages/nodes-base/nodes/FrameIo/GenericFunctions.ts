import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	IWebhookFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

import {
	DEFAULT_CACHE_TTL_MS,
	FRAME_IO_API_BASE,
	FRAME_IO_CREDENTIAL,
	MEDIA_LINK_INCLUDE_MAP,
} from './constants';
import type { FrameIoCacheStore, FrameIoEnrichProfile, FrameIoWebhookPayload } from './types';

type FrameIoRequestContext =
	| IHookFunctions
	| IExecuteFunctions
	| ILoadOptionsFunctions
	| IWebhookFunctions;

const sleep = async (ms: number) => await new Promise((resolve) => setTimeout(resolve, ms));

export function buildIncludeParam(includes: string[]): string | undefined {
	const unique = [...new Set(includes.filter(Boolean))];
	if (unique.length === 0) return undefined;
	return unique.join(',');
}

export function buildCacheKey(
	accountId: string,
	method: string,
	path: string,
	includeHash: string,
): string {
	return `${accountId}:${method}:${path}:${includeHash}`;
}

export function getCacheStore(staticData: IDataObject): FrameIoCacheStore {
	if (!staticData.frameIoResourceCache) {
		staticData.frameIoResourceCache = { entries: {} };
	}
	return staticData.frameIoResourceCache as FrameIoCacheStore;
}

export function getCachedResource(
	staticData: IDataObject,
	cacheKey: string,
	ttlMs: number = DEFAULT_CACHE_TTL_MS,
): IDataObject | undefined {
	const store = getCacheStore(staticData);
	const entry = store.entries?.[cacheKey];
	if (!entry || entry.stale) return undefined;
	if (Date.now() - entry.cachedAt > ttlMs) return undefined;
	return entry.data;
}

export function setCachedResource(
	staticData: IDataObject,
	cacheKey: string,
	data: IDataObject,
): void {
	const store = getCacheStore(staticData);
	if (!store.entries) store.entries = {};
	store.entries[cacheKey] = { data, cachedAt: Date.now() };
}

export function invalidateCacheFromWebhook(
	staticData: IDataObject,
	body: FrameIoWebhookPayload,
): void {
	const store = getCacheStore(staticData);
	if (!store.entries) return;

	const resourceId = body.resource?.id;
	const projectId = body.project?.id;
	const keysToInvalidate = new Set<string>();

	for (const key of Object.keys(store.entries)) {
		if (resourceId && key.includes(resourceId)) {
			keysToInvalidate.add(key);
		}
		if (projectId && key.includes(projectId)) {
			keysToInvalidate.add(key);
		}
	}

	for (const key of keysToInvalidate) {
		delete store.entries[key];
	}
}

export function eventMatchesPattern(eventType: string, patterns: string[]): boolean {
	if (patterns.length === 0) return true;
	for (const pattern of patterns) {
		if (pattern === eventType) return true;
		if (pattern.endsWith('.*')) {
			const prefix = pattern.slice(0, -2);
			if (eventType.startsWith(`${prefix}.`)) return true;
		}
	}
	return false;
}

export async function frameIoApiRequest(
	this: FrameIoRequestContext,
	method: IHttpRequestMethods,
	endpoint: string,
	body: IDataObject = {},
	qs: IDataObject = {},
	option: IDataObject = {},
): Promise<IDataObject> {
	const options: IHttpRequestOptions = {
		method,
		url: `${FRAME_IO_API_BASE}${endpoint}`,
		json: true,
		qs,
		body,
		...option,
	};

	if (Object.keys(qs).length === 0) {
		delete options.qs;
	}

	if (Object.keys(body).length === 0) {
		delete options.body;
	}

	let attempt = 0;
	const maxAttempts = 4;

	while (attempt < maxAttempts) {
		try {
			return (await this.helpers.httpRequestWithAuthentication.call(
				this,
				FRAME_IO_CREDENTIAL,
				options,
			)) as IDataObject;
		} catch (error) {
			const statusCode = (error as JsonObject).statusCode as number | undefined;
			if (statusCode === 429 && attempt < maxAttempts - 1) {
				const backoffMs = 1000 * 2 ** attempt;
				await sleep(backoffMs);
				attempt++;
				continue;
			}
			throw new NodeApiError(this.getNode(), error as JsonObject);
		}
	}

	throw new NodeApiError(this.getNode(), { message: 'Frame.io API request failed after retries' });
}

export async function frameIoApiRequestAllItems(
	this: FrameIoRequestContext,
	method: IHttpRequestMethods,
	endpoint: string,
	propertyName = 'data',
	qs: IDataObject = {},
): Promise<IDataObject[]> {
	const returnData: IDataObject[] = [];
	let after: string | undefined;

	do {
		const query: IDataObject = { ...qs, page_size: qs.page_size ?? 50 };
		if (after) {
			query.after = after;
		}

		const response = await frameIoApiRequest.call(this, method, endpoint, {}, query);
		const items = (response[propertyName] as IDataObject[]) ?? [];
		returnData.push(...items);

		const links = response.links as IDataObject | undefined;
		const next = links?.next as string | undefined;
		after = undefined;
		if (next) {
			const url = new URL(next, FRAME_IO_API_BASE);
			after = url.searchParams.get('after') ?? undefined;
		}
	} while (after);

	return returnData;
}

function getMediaLinkIncludes(mediaLinks: string[]): string[] {
	return mediaLinks.map((key) => MEDIA_LINK_INCLUDE_MAP[key]).filter(Boolean);
}

function getShowPath(
	accountId: string,
	resourceType: string,
	resourceId: string,
): string | undefined {
	switch (resourceType) {
		case 'file':
			return `/v4/accounts/${accountId}/files/${resourceId}`;
		case 'folder':
			return `/v4/accounts/${accountId}/folders/${resourceId}`;
		case 'comment':
			return `/v4/accounts/${accountId}/comments/${resourceId}`;
		case 'project':
			return `/v4/accounts/${accountId}/projects/${resourceId}`;
		case 'share':
			return `/v4/accounts/${accountId}/shares/${resourceId}`;
		case 'collection':
			return `/v4/accounts/${accountId}/collections/${resourceId}`;
		case 'customfield':
			return `/v4/accounts/${accountId}/custom_fields/${resourceId}`;
		default:
			return undefined;
	}
}

export async function enrichEventPayload(
	this: FrameIoRequestContext,
	payload: FrameIoWebhookPayload,
	profiles: FrameIoEnrichProfile[],
	options: {
		mediaLinks?: string[];
		skipOnDelete?: boolean;
		staticData?: IDataObject;
	},
): Promise<IDataObject> {
	const output: IDataObject = { ...payload };

	if (options.skipOnDelete && payload.type?.endsWith('.deleted')) {
		return output;
	}

	const accountId = payload.account?.id;
	const resourceType = payload.resource?.type;
	const resourceId = payload.resource?.id;

	if (!accountId || !resourceType || !resourceId) {
		return output;
	}

	const includes: string[] = [];
	if (profiles.includes('project')) includes.push('project', 'project.owner');
	if (profiles.includes('metadata')) includes.push('metadata');
	if (profiles.includes('actor') && resourceType === 'file') includes.push('creator');
	if (profiles.includes('actor') && resourceType === 'comment') includes.push('owner');
	if (profiles.includes('mediaLinks') && options.mediaLinks?.length) {
		includes.push(...getMediaLinkIncludes(options.mediaLinks));
	}

	if (
		profiles.includes('resource') ||
		profiles.includes('project') ||
		profiles.includes('metadata') ||
		profiles.includes('actor') ||
		profiles.includes('mediaLinks')
	) {
		const path = getShowPath(accountId, resourceType, resourceId);
		if (path) {
			const includeParam = buildIncludeParam(includes);
			const includeHash = includeParam ?? '';
			const cacheKey = options.staticData ? buildCacheKey(accountId, 'GET', path, includeHash) : '';

			let resourceData: IDataObject | undefined;
			if (options.staticData && cacheKey) {
				resourceData = getCachedResource(options.staticData, cacheKey);
			}

			if (!resourceData) {
				const qs: IDataObject = {};
				if (includeParam) qs.include = includeParam;
				const response = await frameIoApiRequest.call(this, 'GET', path, {}, qs);
				resourceData = (response.data as IDataObject) ?? response;
				if (options.staticData && cacheKey && resourceData) {
					setCachedResource(options.staticData, cacheKey, resourceData);
				}
			}

			if (resourceData) {
				output.resource_data = resourceData;
				if (profiles.includes('project') && resourceData.project) {
					output.project_data = resourceData.project as IDataObject;
				}
				if (profiles.includes('actor')) {
					const actor =
						(resourceData.creator as IDataObject) ?? (resourceData.owner as IDataObject);
					if (actor) output.user_data = actor;
				}
			}
		}
	}

	if (
		profiles.includes('parentFolder') &&
		(resourceType === 'file' || resourceType === 'comment')
	) {
		const fileId =
			resourceType === 'file'
				? resourceId
				: ((output.resource_data as IDataObject)?.file_id as string);
		if (fileId) {
			const folderPath = await getFolderPathForFile.call(this, accountId, fileId);
			if (folderPath.length) {
				output.folder_path = folderPath;
				output.folder_data = folderPath[folderPath.length - 1];
			}
		}
	}

	if (profiles.includes('project') && !output.project_data && payload.project?.id) {
		const projectPath = `/v4/accounts/${accountId}/projects/${payload.project.id}`;
		const response = await frameIoApiRequest.call(
			this,
			'GET',
			projectPath,
			{},
			{ include: 'owner' },
		);
		output.project_data = (response.data as IDataObject) ?? response;
	}

	return output;
}

export async function getFolderPathForFile(
	this: FrameIoRequestContext,
	accountId: string,
	fileId: string,
	maxDepth = 20,
): Promise<IDataObject[]> {
	const path: IDataObject[] = [];
	const fileResponse = await frameIoApiRequest.call(
		this,
		'GET',
		`/v4/accounts/${accountId}/files/${fileId}`,
	);
	const fileData = (fileResponse.data as IDataObject) ?? fileResponse;
	let parentId = fileData.parent_id as string | undefined;

	let depth = 0;
	while (parentId && depth < maxDepth) {
		const folderResponse = await frameIoApiRequest.call(
			this,
			'GET',
			`/v4/accounts/${accountId}/folders/${parentId}`,
		);
		const folderData = (folderResponse.data as IDataObject) ?? folderResponse;
		path.unshift(folderData);
		parentId = folderData.parent_id as string | undefined;
		depth++;
	}

	return path;
}

export async function isResourceInFolderScope(
	this: FrameIoRequestContext,
	accountId: string,
	payload: FrameIoWebhookPayload,
	targetFolderId: string,
	folderScope: 'exact' | 'subtree',
): Promise<boolean> {
	const resourceType = payload.resource?.type;
	const resourceId = payload.resource?.id;

	if (!resourceType || !resourceId) return false;

	if (resourceType === 'folder') {
		if (resourceId === targetFolderId) return true;
		if (folderScope === 'exact') return false;
		const path = await getFolderPathForFolder.call(this, accountId, resourceId);
		return path.some((folder) => folder.id === targetFolderId);
	}

	if (resourceType === 'file' || resourceType === 'comment') {
		const fileId =
			resourceType === 'file'
				? resourceId
				: await getFileIdForComment.call(this, accountId, resourceId);
		if (!fileId) return false;
		const path = await getFolderPathForFile.call(this, accountId, fileId);
		const folderIds = path.map((folder) => folder.id as string);
		if (folderScope === 'exact') {
			return folderIds[folderIds.length - 1] === targetFolderId;
		}
		return folderIds.includes(targetFolderId);
	}

	return false;
}

async function getFileIdForComment(
	this: FrameIoRequestContext,
	accountId: string,
	commentId: string,
): Promise<string | undefined> {
	const response = await frameIoApiRequest.call(
		this,
		'GET',
		`/v4/accounts/${accountId}/comments/${commentId}`,
	);
	const data = (response.data as IDataObject) ?? response;
	return data.file_id as string | undefined;
}

export async function getFolderPathForFolder(
	this: FrameIoRequestContext,
	accountId: string,
	folderId: string,
	maxDepth = 20,
): Promise<IDataObject[]> {
	const path: IDataObject[] = [];
	let currentId: string | undefined = folderId;
	let depth = 0;

	while (currentId && depth < maxDepth) {
		const response = await frameIoApiRequest.call(
			this,
			'GET',
			`/v4/accounts/${accountId}/folders/${currentId}`,
		);
		const folderData = (response.data as IDataObject) ?? response;
		path.unshift(folderData);
		currentId = folderData.parent_id as string | undefined;
		depth++;
	}

	return path;
}

export function extractResourceLocatorValue(
	value: string | { value?: string; mode?: string } | undefined,
): string | undefined {
	if (!value) return undefined;
	if (typeof value === 'string') return value;
	return value.value;
}
