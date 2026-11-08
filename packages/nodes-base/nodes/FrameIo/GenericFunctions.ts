import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	IWebhookFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

import { FRAME_IO_API_BASE, FRAME_IO_CREDENTIAL, MEDIA_LINK_INCLUDE_MAP } from './constants';
import {
	FrameIoResourceCache,
	frameIoResourceCache,
	pathReferencesEvent,
} from './FrameIoResourceCache';
import type { FrameIoEnrichProfile, FrameIoWebhookPayload } from './types';

type FrameIoRequestContext =
	| IHookFunctions
	| IExecuteFunctions
	| ILoadOptionsFunctions
	| IWebhookFunctions;

const sleep = async (ms: number) => await new Promise((resolve) => setTimeout(resolve, ms));

const MAX_RETRY_AFTER_MS = 30_000;

const DEFAULT_RESOURCE_LABEL_FIELDS = ['display_name', 'name', 'title'] as const;

export function getFrameIoResourceLabel(
	resource: IDataObject,
	labelFields: readonly string[] = DEFAULT_RESOURCE_LABEL_FIELDS,
): string | undefined {
	for (const field of labelFields) {
		const value = resource[field];
		if (typeof value === 'string' && value.trim().length > 0) {
			return value;
		}
	}
	return undefined;
}

export function toFrameIoResourceOption(
	resource: IDataObject,
	labelFields: readonly string[] = DEFAULT_RESOURCE_LABEL_FIELDS,
): INodePropertyOptions {
	const id = resource.id as string;
	const label = getFrameIoResourceLabel(resource, labelFields);

	return {
		name: label ?? id,
		value: id,
		...(label && label !== id ? { description: id } : {}),
	};
}

export function buildIncludeParam(includes: string[]): string | undefined {
	const unique = [...new Set(includes.filter(Boolean))];
	if (unique.length === 0) return undefined;
	return unique.join(',');
}

/**
 * Cache scope for the node's Frame.io credential. Returns undefined when the credential
 * has no ID, in which case callers skip the shared cache entirely.
 */
export function getCredentialCacheScope(this: FrameIoRequestContext): string | undefined {
	return this.getNode().credentials?.[FRAME_IO_CREDENTIAL]?.id ?? undefined;
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

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

/** Status code from raw axios errors (`response.status`) or wrapped NodeApiErrors (`httpCode`). */
export function getErrorStatusCode(error: unknown): number | undefined {
	if (!isObject(error)) return undefined;
	const response = isObject(error.response) ? error.response : undefined;
	const candidates = [error.statusCode, error.status, response?.status, error.httpCode];
	for (const candidate of candidates) {
		const parsed = typeof candidate === 'string' ? Number(candidate) : candidate;
		if (typeof parsed === 'number' && Number.isInteger(parsed)) return parsed;
	}
	return undefined;
}

function getRetryAfterMs(error: unknown): number | undefined {
	if (!isObject(error) || !isObject(error.response) || !isObject(error.response.headers)) {
		return undefined;
	}
	const seconds = Number(error.response.headers['retry-after']);
	if (!Number.isFinite(seconds) || seconds < 0) return undefined;
	return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
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
			if (getErrorStatusCode(error) === 429 && attempt < maxAttempts - 1) {
				const backoffMs = getRetryAfterMs(error) ?? 1000 * 2 ** attempt;
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
	limit?: number,
): Promise<IDataObject[]> {
	const returnData: IDataObject[] = [];
	let after: string | undefined;

	do {
		if (limit !== undefined && returnData.length >= limit) break;
		const query: IDataObject = { ...qs, page_size: qs.page_size ?? 50 };
		if (after) {
			query.after = after;
		}

		const response = await frameIoApiRequest.call(this, method, endpoint, {}, query);
		const items = (response[propertyName] as IDataObject[]) ?? [];
		returnData.push.apply(returnData, items);

		const links = response.links as IDataObject | undefined;
		const next = links?.next as string | undefined;
		after = undefined;
		if (next) {
			const url = new URL(next, FRAME_IO_API_BASE);
			after = url.searchParams.get('after') ?? undefined;
		}
	} while (after);

	return limit === undefined ? returnData : returnData.slice(0, limit);
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
		cache?: FrameIoLookupCache;
	},
): Promise<IDataObject> {
	const output: IDataObject = { ...payload };
	const cache = options.cache;

	if (options.skipOnDelete && payload.type?.endsWith('.deleted')) {
		return output;
	}

	const accountId = payload.account?.id;
	const resourceType = payload.resource?.type;
	const resourceId = payload.resource?.id;

	if (!accountId || !resourceType || !resourceId) {
		return output;
	}

	// The event may describe a change, so never serve its own resource from cache.
	if (cache) invalidateLookupForEvent(cache, payload);

	// File-only includes (`metadata`, `media_links.*`, `project`) 422 on comments/folders.
	const includes: string[] = [];
	if (profiles.includes('project') && resourceType === 'file') {
		includes.push('project', 'project.owner');
	}
	if (profiles.includes('metadata') && resourceType === 'file') {
		includes.push('metadata');
	}
	if (profiles.includes('actor') && resourceType === 'file') includes.push('creator');
	if (profiles.includes('actor') && resourceType === 'comment') includes.push('owner');
	if (profiles.includes('mediaLinks') && resourceType === 'file' && options.mediaLinks?.length) {
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
			const resourceData = await getResourceData.call(
				this,
				path,
				cache,
				buildIncludeParam(includes),
			);
			output.resource_data = resourceData;
			if (profiles.includes('project') && resourceData.project) {
				output.project_data = resourceData.project as IDataObject;
			}
			if (profiles.includes('actor')) {
				const actor = (resourceData.creator as IDataObject) ?? (resourceData.owner as IDataObject);
				if (actor) output.user_data = actor;
			}
		}
	}

	// Comments don't support metadata/media_links includes — load the parent file instead.
	if (
		resourceType === 'comment' &&
		(profiles.includes('metadata') || profiles.includes('mediaLinks'))
	) {
		const fileId = (output.resource_data as IDataObject | undefined)?.file_id as string | undefined;
		if (fileId) {
			const fileIncludes: string[] = [];
			if (profiles.includes('metadata')) fileIncludes.push('metadata');
			if (profiles.includes('mediaLinks') && options.mediaLinks?.length) {
				fileIncludes.push(...getMediaLinkIncludes(options.mediaLinks));
			}
			output.file_data = await getResourceData.call(
				this,
				`/v4/accounts/${accountId}/files/${fileId}`,
				cache,
				buildIncludeParam(fileIncludes),
			);
		}
	}

	if (
		profiles.includes('parentFolder') &&
		(resourceType === 'file' || resourceType === 'comment')
	) {
		let fileId: string | undefined = resourceId;
		if (resourceType === 'comment') {
			// resource_data is only fetched when another profile asked for it.
			fileId =
				((output.resource_data as IDataObject | undefined)?.file_id as string | undefined) ??
				(await getFileIdForComment.call(this, accountId, resourceId, cache));
		}
		if (fileId) {
			const folderPath = await getFolderPathForFile.call(this, accountId, fileId, 20, cache);
			if (folderPath.length) {
				output.folder_path = folderPath;
				output.folder_data = folderPath[folderPath.length - 1];
			}
		}
	}

	if (profiles.includes('project') && !output.project_data && payload.project?.id) {
		output.project_data = await getResourceData.call(
			this,
			`/v4/accounts/${accountId}/projects/${payload.project.id}`,
			cache,
			'owner',
		);
	}

	return output;
}

/**
 * GET lookups for one execution. `memo` dedupes requests within the execution;
 * `sharedScope` (a credential scope) additionally enables the cross-execution cache.
 */
export interface FrameIoLookupCache {
	memo: Map<string, Promise<IDataObject>>;
	shareAssetIds: Map<string, Promise<Set<string>>>;
	sharedScope?: string;
}

export function createLookupCache(sharedScope?: string): FrameIoLookupCache {
	return { memo: new Map(), shareAssetIds: new Map(), sharedScope };
}

/** Drops lookups the event may have made stale, in this execution and the shared cache. */
export function invalidateLookupForEvent(
	cache: FrameIoLookupCache,
	payload: FrameIoWebhookPayload,
): void {
	for (const key of [...cache.memo.keys()]) {
		if (pathReferencesEvent(key.split('?')[0], payload)) cache.memo.delete(key);
	}
	if (cache.sharedScope) frameIoResourceCache.invalidateForEvent(cache.sharedScope, payload);
}

async function getResourceData(
	this: FrameIoRequestContext,
	path: string,
	cache?: FrameIoLookupCache,
	include?: string,
): Promise<IDataObject> {
	const memoKey = include ? `${path}?include=${include}` : path;
	const pending = cache?.memo.get(memoKey);
	if (pending) return await pending;

	const sharedKey = cache?.sharedScope
		? FrameIoResourceCache.buildKey(cache.sharedScope, path, include)
		: undefined;
	const shared = sharedKey ? frameIoResourceCache.get(sharedKey) : undefined;
	if (shared) return shared;

	const request = frameIoApiRequest
		.call(this, 'GET', path, {}, include ? { include } : {})
		.then((response) => (response.data as IDataObject) ?? response);
	cache?.memo.set(memoKey, request);
	try {
		const data = await request;
		if (sharedKey) frameIoResourceCache.set(sharedKey, data);
		return data;
	} catch (error) {
		cache?.memo.delete(memoKey);
		throw error;
	}
}

export async function getFolderPathForFile(
	this: FrameIoRequestContext,
	accountId: string,
	fileId: string,
	maxDepth = 20,
	cache?: FrameIoLookupCache,
): Promise<IDataObject[]> {
	const fileData = await getResourceData.call(
		this,
		`/v4/accounts/${accountId}/files/${fileId}`,
		cache,
	);
	const parentId = fileData.parent_id as string | undefined;
	if (!parentId) return [];
	return await getFolderPathForFolder.call(this, accountId, parentId, maxDepth, cache);
}

export async function isResourceInFolderScope(
	this: FrameIoRequestContext,
	accountId: string,
	payload: FrameIoWebhookPayload,
	targetFolderId: string,
	folderScope: 'exact' | 'subtree',
	cache?: FrameIoLookupCache,
): Promise<boolean> {
	const resourceType = payload.resource?.type;
	const resourceId = payload.resource?.id;

	if (!resourceType || !resourceId) return false;

	if (resourceType === 'folder') {
		if (resourceId === targetFolderId) return true;
		if (folderScope === 'exact') return false;
		const path = await getFolderPathForFolder.call(this, accountId, resourceId, 20, cache);
		return path.some((folder) => folder.id === targetFolderId);
	}

	if (resourceType === 'file' || resourceType === 'comment') {
		const fileId =
			resourceType === 'file'
				? resourceId
				: await getFileIdForComment.call(this, accountId, resourceId, cache);
		if (!fileId) return false;
		const path = await getFolderPathForFile.call(this, accountId, fileId, 20, cache);
		const folderIds = path.map((folder) => folder.id as string);
		if (folderScope === 'exact') {
			return folderIds[folderIds.length - 1] === targetFolderId;
		}
		return folderIds.includes(targetFolderId);
	}

	return false;
}

/** IDs of everything in a share; the API lists shared folders' descendants as their own rows. */
async function getShareAssetIds(
	this: FrameIoRequestContext,
	accountId: string,
	shareId: string,
	cache?: FrameIoLookupCache,
): Promise<Set<string>> {
	const pending = cache?.shareAssetIds.get(shareId);
	if (pending) return await pending;
	const request = frameIoApiRequestAllItems
		.call(this, 'GET', `/v4/accounts/${accountId}/shares/${shareId}/assets`)
		.then((assets) => new Set(assets.map((asset) => asset.id as string)));
	cache?.shareAssetIds.set(shareId, request);
	try {
		return await request;
	} catch (error) {
		cache?.shareAssetIds.delete(shareId);
		throw error;
	}
}

export async function isResourceInShare(
	this: FrameIoRequestContext,
	accountId: string,
	payload: FrameIoWebhookPayload,
	shareId: string,
	cache?: FrameIoLookupCache,
): Promise<boolean> {
	const resourceType = payload.resource?.type;
	const resourceId = payload.resource?.id;
	if (!resourceType || !resourceId) return false;
	if (resourceType === 'share') return resourceId === shareId;

	let assetId: string | undefined;
	if (resourceType === 'file' || resourceType === 'folder') {
		assetId = resourceId;
	} else if (resourceType === 'comment') {
		assetId = await getFileIdForComment.call(this, accountId, resourceId, cache);
	}
	if (!assetId) return false;

	const assetIds = await getShareAssetIds.call(this, accountId, shareId, cache);
	return assetIds.has(assetId);
}

async function getFileIdForComment(
	this: FrameIoRequestContext,
	accountId: string,
	commentId: string,
	cache?: FrameIoLookupCache,
): Promise<string | undefined> {
	const data = await getResourceData.call(
		this,
		`/v4/accounts/${accountId}/comments/${commentId}`,
		cache,
	);
	return data.file_id as string | undefined;
}

export async function getFolderPathForFolder(
	this: FrameIoRequestContext,
	accountId: string,
	folderId: string,
	maxDepth = 20,
	cache?: FrameIoLookupCache,
): Promise<IDataObject[]> {
	const path: IDataObject[] = [];
	let currentId: string | undefined = folderId;
	let depth = 0;

	while (currentId && depth < maxDepth) {
		const folderData = await getResourceData.call(
			this,
			`/v4/accounts/${accountId}/folders/${currentId}`,
			cache,
		);
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
