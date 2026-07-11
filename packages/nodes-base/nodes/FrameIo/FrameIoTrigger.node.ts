import type { INodeTypeBaseDescription } from 'n8n-workflow';
import { VersionedNodeType } from 'n8n-workflow';

import { FrameIoTriggerV1 } from './V1/FrameIoTriggerV1.node';

export class FrameIoTrigger extends VersionedNodeType {
	constructor() {
		const baseDescription: INodeTypeBaseDescription = {
			displayName: 'Frame.io Trigger',
			name: 'frameIoTrigger',
			icon: 'file:frameIo.svg',
			group: ['trigger'],
			description: 'Starts the workflow when Frame.io events occur',
			defaultVersion: 1,
		};

		const nodeVersions = {
			1: new FrameIoTriggerV1(baseDescription),
		};

		super(nodeVersions, baseDescription);
	}
}
