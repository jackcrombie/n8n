import { FRAME_IO_WEBHOOK_EVENTS } from './constants';
import { extractResourceLocatorValue } from './GenericFunctions';
import type { FrameIoWebhookPayload } from './types';

export interface FrameIoFilterRoute {
	passAllEvents?: boolean;
	events?: string[];
	projectId?: string;
	scopeType?: 'none' | 'folder' | 'file' | 'share';
	folder?: string | { value?: string };
	file?: string | { value?: string };
	share?: string | { value?: string };
	folderScope?: 'exact' | 'subtree';
	shareScope?: 'entire_share' | 'folder_in_share' | 'folder_in_share_subtree';
	shareFolder?: string | { value?: string };
	outputKey?: string;
}

export function routeMatchesEvent(route: FrameIoFilterRoute, eventType: string): boolean {
	if (route.passAllEvents) return true;
	const events = route.events ?? [];
	if (events.length === 0) return true;

	for (const pattern of events) {
		if (pattern === eventType) return true;
		if (pattern.endsWith('.*')) {
			const prefix = pattern.slice(0, -2);
			if (eventType.startsWith(`${prefix}.`)) return true;
		}
	}
	return false;
}

export function routeMatchesProject(
	route: FrameIoFilterRoute,
	payload: FrameIoWebhookPayload,
): boolean {
	if (!route.projectId) return true;
	return payload.project?.id === route.projectId;
}

export function routeMatchesResourceScope(
	route: FrameIoFilterRoute,
	payload: FrameIoWebhookPayload,
): boolean {
	const scopeType = route.scopeType ?? 'none';
	if (scopeType === 'none') return true;

	const resourceType = payload.resource?.type;
	const resourceId = payload.resource?.id;
	if (!resourceType || !resourceId) return false;

	if (scopeType === 'file') {
		const fileId = extractResourceLocatorValue(route.file);
		return resourceType === 'file' && !!fileId && resourceId === fileId;
	}

	if (scopeType === 'share') {
		const shareId = extractResourceLocatorValue(route.share);
		if (!shareId) return true;
		if (resourceType === 'share') {
			return resourceId === shareId;
		}
		return false;
	}

	return true;
}

export const frameIoFilterEventOptions = FRAME_IO_WEBHOOK_EVENTS.map((event) => ({
	name: event.name,
	value: event.value,
}));
