import type { INodeTypeBaseDescription } from 'n8n-workflow';
import { VersionedNodeType } from 'n8n-workflow';

import { FrameIoV1 } from './V1/FrameIoV1.node';

export class FrameIo extends VersionedNodeType {
	constructor() {
		const baseDescription: INodeTypeBaseDescription = {
			displayName: 'Frame.io',
			name: 'frameIo',
			icon: 'file:frameIo.svg',
			group: ['transform'],
			description: 'Consume the Frame.io API',
			defaultVersion: 1,
		};

		const nodeVersions = {
			1: new FrameIoV1(baseDescription),
		};

		super(nodeVersions, baseDescription);
	}
}
