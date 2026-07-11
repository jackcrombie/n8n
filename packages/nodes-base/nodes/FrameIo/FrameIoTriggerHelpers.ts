import { createHmac, timingSafeEqual } from 'crypto';
import type { IWebhookFunctions } from 'n8n-workflow';

const TIMESTAMP_TOLERANCE_SECONDS = 300;

export function verifyFrameIoSignature(
	signingSecret: string,
	timestamp: string,
	rawBody: string,
	signature: string,
): boolean {
	const currentTimestamp = Math.floor(Date.now() / 1000);
	const requestTimestamp = parseInt(timestamp, 10);

	if (Number.isNaN(requestTimestamp)) {
		return false;
	}

	if (Math.abs(currentTimestamp - requestTimestamp) > TIMESTAMP_TOLERANCE_SECONDS) {
		return false;
	}

	const message = `v0:${timestamp}:${rawBody}`;
	const calculated = `v0=${createHmac('sha256', signingSecret).update(message, 'utf8').digest('hex')}`;

	try {
		const calculatedBuffer = Buffer.from(calculated);
		const providedBuffer = Buffer.from(signature);
		return (
			calculatedBuffer.length === providedBuffer.length &&
			timingSafeEqual(calculatedBuffer, providedBuffer)
		);
	} catch {
		return false;
	}
}

export async function verifyFrameIoWebhook(this: IWebhookFunctions): Promise<boolean> {
	const webhookData = this.getWorkflowStaticData('node');
	const signingSecret = webhookData.signingSecret as string | undefined;

	if (!signingSecret) {
		return false;
	}

	const req = this.getRequestObject();
	const signature = req.header('x-frameio-signature');
	const timestamp = req.header('x-frameio-request-timestamp');

	if (!signature || !timestamp || !req.rawBody) {
		return false;
	}

	let rawBodyString: string;
	if (Buffer.isBuffer(req.rawBody)) {
		rawBodyString = req.rawBody.toString('utf8');
	} else {
		rawBodyString = typeof req.rawBody === 'string' ? req.rawBody : JSON.stringify(req.rawBody);
	}

	return verifyFrameIoSignature(signingSecret, timestamp, rawBodyString, signature);
}
