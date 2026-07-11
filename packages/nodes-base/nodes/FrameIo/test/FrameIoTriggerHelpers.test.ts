import { createHmac } from 'crypto';

import { verifyFrameIoSignature } from '../FrameIoTriggerHelpers';

describe('FrameIoTriggerHelpers', () => {
	const signingSecret = 'test-signing-secret';
	const rawBody = '{"type":"file.ready","resource":{"id":"file-1","type":"file"}}';
	const timestamp = '1700000000';

	function buildSignature(secret: string, ts: string, body: string): string {
		const message = `v0:${ts}:${body}`;
		return `v0=${createHmac('sha256', secret).update(message, 'utf8').digest('hex')}`;
	}

	beforeEach(() => {
		jest.spyOn(Date, 'now').mockReturnValue(1700000000 * 1000);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('should verify a valid signature', () => {
		const signature = buildSignature(signingSecret, timestamp, rawBody);
		expect(verifyFrameIoSignature(signingSecret, timestamp, rawBody, signature)).toBe(true);
	});

	it('should reject an invalid signature', () => {
		expect(verifyFrameIoSignature(signingSecret, timestamp, rawBody, 'v0=invalid')).toBe(false);
	});

	it('should reject timestamps outside the replay window', () => {
		const oldTimestamp = '1699990000';
		const signature = buildSignature(signingSecret, oldTimestamp, rawBody);
		expect(verifyFrameIoSignature(signingSecret, oldTimestamp, rawBody, signature)).toBe(false);
	});

	it('should reject invalid timestamp values', () => {
		const signature = buildSignature(signingSecret, timestamp, rawBody);
		expect(verifyFrameIoSignature(signingSecret, 'not-a-number', rawBody, signature)).toBe(false);
	});
});
