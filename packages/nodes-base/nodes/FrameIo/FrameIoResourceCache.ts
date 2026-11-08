import type { IDataObject } from 'n8n-workflow';
import { deepCopy } from 'n8n-workflow';

import { DEFAULT_CACHE_TTL_MS } from './constants';
import type { FrameIoWebhookPayload } from './types';

const DEFAULT_MAX_ENTRIES = 500;

/**
 * Whether an API path points at something the event may have changed: the event's
 * resource, or its project on project events. Matches whole path segments only.
 */
export function pathReferencesEvent(path: string, payload: FrameIoWebhookPayload): boolean {
	const ids = new Set<string>();
	if (payload.resource?.id) ids.add(payload.resource.id);
	if (payload.resource?.type === 'project' && payload.project?.id) ids.add(payload.project.id);
	return path.split('/').some((segment) => ids.has(segment));
}

interface CacheEntry {
	data: IDataObject;
	cachedAt: number;
}

/**
 * In-memory LRU of Frame.io GET responses. It lives in process memory rather than
 * workflow static data, so nothing is persisted to the database or shared with the
 * trigger's webhook state. Keys are prefixed with a credential scope so workflows
 * using different credentials never read each other's data.
 */
export class FrameIoResourceCache {
	private readonly entries = new Map<string, CacheEntry>();

	constructor(
		private readonly ttlMs = DEFAULT_CACHE_TTL_MS,
		private readonly maxEntries = DEFAULT_MAX_ENTRIES,
	) {}

	static buildKey(scope: string, path: string, include = ''): string {
		return `${scope}|${path}|${include}`;
	}

	get size(): number {
		return this.entries.size;
	}

	get(key: string): IDataObject | undefined {
		const entry = this.entries.get(key);
		if (!entry) return undefined;
		if (Date.now() - entry.cachedAt > this.ttlMs) {
			this.entries.delete(key);
			return undefined;
		}
		// Re-insert to mark as most recently used.
		this.entries.delete(key);
		this.entries.set(key, entry);
		return deepCopy(entry.data);
	}

	set(key: string, data: IDataObject): void {
		this.entries.delete(key);
		this.entries.set(key, { data: deepCopy(data), cachedAt: Date.now() });
		while (this.entries.size > this.maxEntries) {
			const oldest = this.entries.keys().next().value;
			if (oldest === undefined) break;
			this.entries.delete(oldest);
		}
	}

	/** Drops this scope's entries the event may have made stale. */
	invalidateForEvent(scope: string, payload: FrameIoWebhookPayload): void {
		for (const key of this.entries.keys()) {
			const [keyScope, path] = key.split('|');
			if (keyScope === scope && pathReferencesEvent(path, payload)) this.entries.delete(key);
		}
	}

	clear(): void {
		this.entries.clear();
	}
}

export const frameIoResourceCache = new FrameIoResourceCache();
