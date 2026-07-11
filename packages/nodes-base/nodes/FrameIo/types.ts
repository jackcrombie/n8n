import type { IDataObject } from 'n8n-workflow';

export interface FrameIoIdRef {
	id: string;
}

export interface FrameIoResourceRef {
	id: string;
	type: string;
}

export interface FrameIoWebhookPayload extends IDataObject {
	type: string;
	account: FrameIoIdRef;
	workspace: FrameIoIdRef;
	project: FrameIoIdRef;
	user: FrameIoIdRef;
	resource: FrameIoResourceRef;
}

export interface FrameIoCacheEntry {
	data: IDataObject;
	cachedAt: number;
	stale?: boolean;
}

export interface FrameIoCacheStore {
	entries?: Record<string, FrameIoCacheEntry>;
}

export type FrameIoEnrichProfile =
	| 'resource'
	| 'project'
	| 'actor'
	| 'metadata'
	| 'mediaLinks'
	| 'parentFolder';
