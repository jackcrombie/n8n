import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { createLookupCache, enrichEventPayload, getCredentialCacheScope } from './GenericFunctions';
import type { FrameIoEnrichProfile, FrameIoWebhookPayload } from './types';

/** Fields enrichment added on top of the incoming payload. */
function pickEnrichedFields(payload: IDataObject, enriched: IDataObject): IDataObject {
	return Object.fromEntries(
		Object.entries(enriched).filter(([key]) => !Object.prototype.hasOwnProperty.call(payload, key)),
	);
}

export class FrameIoEnrich implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Frame.io Enrich',
		name: 'frameIoEnrich',
		icon: 'file:frameIo.svg',
		group: ['transform'],
		version: 1,
		description:
			'Enrich Frame.io event payloads with names, metadata, media links, and user details',
		defaults: {
			name: 'Frame.io Enrich',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'frameIoOAuth2Api',
				required: true,
			},
		],
		properties: [
			{
				displayName:
					'Guest reviewers commenting via share links may return empty name and email in the API. Registered project members work reliably.',
				name: 'guestNotice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Profiles',
				name: 'profiles',
				type: 'multiOptions',
				options: [
					{ name: 'Actor / Author', value: 'actor' },
					{ name: 'Media Links', value: 'mediaLinks' },
					{ name: 'Metadata', value: 'metadata' },
					{ name: 'Parent Folder', value: 'parentFolder' },
					{ name: 'Project', value: 'project' },
					{ name: 'Resource', value: 'resource' },
				],
				default: ['resource', 'actor'],
			},
			{
				displayName: 'Media Links',
				name: 'mediaLinks',
				type: 'multiOptions',
				displayOptions: {
					show: {
						profiles: ['mediaLinks'],
					},
				},
				options: [
					{ name: 'Efficient Transcode', value: 'efficient' },
					{ name: 'High Quality Transcode', value: 'highQuality' },
					{ name: 'Original Download', value: 'original' },
					{ name: 'Preview Video', value: 'previewVideo' },
					{ name: 'Scrub Sheet', value: 'scrubSheet' },
					{ name: 'Thumbnail', value: 'thumbnail' },
					{ name: 'Thumbnail High Quality', value: 'thumbnailHighQuality' },
				],
				default: ['thumbnail', 'thumbnailHighQuality'],
			},
			{
				displayName: 'Skip On Delete Events',
				name: 'skipOnDelete',
				type: 'boolean',
				default: true,
				description: 'Whether to skip enrichment for *.deleted events',
			},
			{
				displayName: 'Output Mode',
				name: 'outputMode',
				type: 'options',
				options: [
					{ name: 'Merge', value: 'merge' },
					{ name: 'Replace', value: 'replace' },
				],
				default: 'merge',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const profiles = this.getNodeParameter('profiles', 0) as FrameIoEnrichProfile[];
		const mediaLinks = this.getNodeParameter('mediaLinks', 0, []) as string[];
		const skipOnDelete = this.getNodeParameter('skipOnDelete', 0) as boolean;
		const outputMode = this.getNodeParameter('outputMode', 0) as string;
		const cache = createLookupCache(getCredentialCacheScope.call(this));

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			const item = items[itemIndex];
			const payload = item.json as FrameIoWebhookPayload;

			try {
				const enriched = await enrichEventPayload.call(this, payload, profiles, {
					mediaLinks,
					skipOnDelete,
					cache,
				});

				returnData.push({
					json: outputMode === 'replace' ? pickEnrichedFields(payload, enriched) : enriched,
					pairedItem: { item: itemIndex },
					binary: item.binary,
				});
			} catch (error) {
				if (!this.continueOnFail()) throw error;
				returnData.push({
					json: { ...item.json, error: (error as Error).message },
					pairedItem: { item: itemIndex },
					binary: item.binary,
				});
			}
		}

		return [returnData];
	}
}
