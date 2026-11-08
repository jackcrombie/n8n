import { FrameIoResourceCache, pathReferencesEvent } from '../FrameIoResourceCache';
import type { FrameIoWebhookPayload } from '../types';

const key = (scope: string, path: string) => FrameIoResourceCache.buildKey(scope, path);

const fileEvent = {
	type: 'file.updated',
	resource: { id: 'file-1', type: 'file' },
	project: { id: 'project-1' },
} as FrameIoWebhookPayload;

describe('FrameIoResourceCache', () => {
	afterEach(() => vi.useRealTimers());

	it('should return a copy of the cached data', () => {
		const cache = new FrameIoResourceCache();
		cache.set(key('cred-1', '/v4/accounts/a/files/file-1'), { id: 'file-1', name: 'Clip' });

		const first = cache.get(key('cred-1', '/v4/accounts/a/files/file-1'));
		if (first) first.name = 'mutated';

		expect(cache.get(key('cred-1', '/v4/accounts/a/files/file-1'))).toEqual({
			id: 'file-1',
			name: 'Clip',
		});
	});

	it('should not share entries between credential scopes', () => {
		const cache = new FrameIoResourceCache();
		cache.set(key('cred-1', '/v4/accounts/a/files/file-1'), { id: 'file-1' });

		expect(cache.get(key('cred-2', '/v4/accounts/a/files/file-1'))).toBeUndefined();
	});

	it('should expire entries after the TTL', () => {
		vi.useFakeTimers();
		const cache = new FrameIoResourceCache(1000);
		cache.set(key('cred-1', '/p'), { id: 'p' });

		vi.advanceTimersByTime(1001);

		expect(cache.get(key('cred-1', '/p'))).toBeUndefined();
	});

	it('should evict the least recently used entry when full', () => {
		const cache = new FrameIoResourceCache(60_000, 2);
		cache.set(key('s', '/a'), { id: 'a' });
		cache.set(key('s', '/b'), { id: 'b' });
		cache.get(key('s', '/a'));
		cache.set(key('s', '/c'), { id: 'c' });

		expect(cache.size).toBe(2);
		expect(cache.get(key('s', '/b'))).toBeUndefined();
		expect(cache.get(key('s', '/a'))).toEqual({ id: 'a' });
	});

	it('should invalidate only the event resource within the same scope', () => {
		const cache = new FrameIoResourceCache();
		cache.set(key('cred-1', '/v4/accounts/a/files/file-1'), { id: 'file-1' });
		cache.set(key('cred-1', '/v4/accounts/a/files/file-10'), { id: 'file-10' });
		cache.set(key('cred-1', '/v4/accounts/a/projects/project-1'), { id: 'project-1' });
		cache.set(key('cred-2', '/v4/accounts/a/files/file-1'), { id: 'file-1' });

		cache.invalidateForEvent('cred-1', fileEvent);

		expect(cache.get(key('cred-1', '/v4/accounts/a/files/file-1'))).toBeUndefined();
		expect(cache.get(key('cred-1', '/v4/accounts/a/files/file-10'))).toBeDefined();
		expect(cache.get(key('cred-1', '/v4/accounts/a/projects/project-1'))).toBeDefined();
		expect(cache.get(key('cred-2', '/v4/accounts/a/files/file-1'))).toBeDefined();
	});

	it('should invalidate the project on project events', () => {
		expect(
			pathReferencesEvent('/v4/accounts/a/projects/project-1', {
				...fileEvent,
				type: 'project.updated',
				resource: { id: 'project-1', type: 'project' },
			}),
		).toBe(true);
		expect(pathReferencesEvent('/v4/accounts/a/projects/project-1', fileEvent)).toBe(false);
	});
});
