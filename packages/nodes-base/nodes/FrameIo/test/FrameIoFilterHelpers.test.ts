import {
	routeMatchesEvent,
	routeMatchesProject,
	routeMatchesResourceScope,
	type FrameIoFilterRoute,
} from '../FrameIoFilterHelpers';
import type { FrameIoWebhookPayload } from '../types';

describe('FrameIoFilterHelpers', () => {
	const payload: FrameIoWebhookPayload = {
		type: 'file.ready',
		account: { id: 'account-1' },
		workspace: { id: 'workspace-1' },
		project: { id: 'project-1' },
		user: { id: 'user-1' },
		resource: { id: 'file-1', type: 'file' },
	};

	it('should pass all events when passAllEvents is enabled', () => {
		const route: FrameIoFilterRoute = { passAllEvents: true, events: ['comment.created'] };
		expect(routeMatchesEvent(route, 'file.ready')).toBe(true);
	});

	it('should match wildcard event patterns', () => {
		const route: FrameIoFilterRoute = { events: ['file.*'] };
		expect(routeMatchesEvent(route, 'file.ready')).toBe(true);
		expect(routeMatchesEvent(route, 'comment.created')).toBe(false);
	});

	it('should match project filters', () => {
		expect(routeMatchesProject({ projectId: 'project-1' }, payload)).toBe(true);
		expect(routeMatchesProject({ projectId: 'project-2' }, payload)).toBe(false);
	});

	it('should match file scope filters', () => {
		const route: FrameIoFilterRoute = {
			scopeType: 'file',
			file: { value: 'file-1' },
		};
		expect(routeMatchesResourceScope(route, payload)).toBe(true);
	});
});
