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

export type FrameIoEnrichProfile =
	| 'resource'
	| 'project'
	| 'actor'
	| 'metadata'
	| 'mediaLinks'
	| 'parentFolder';
