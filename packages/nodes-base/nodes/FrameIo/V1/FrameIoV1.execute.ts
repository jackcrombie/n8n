import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { frameIoApiRequest, frameIoApiRequestAllItems } from '../GenericFunctions';

function unwrapResponse(response: IDataObject): IDataObject {
	return (response.data as IDataObject) ?? response;
}

function buildDataBody(fields: IDataObject): IDataObject {
	const data: IDataObject = {};
	for (const [key, value] of Object.entries(fields)) {
		if (value !== undefined && value !== '' && value !== null) {
			data[key] = value;
		}
	}
	return { data };
}

async function getProjectRootFolderId(
	context: IExecuteFunctions,
	accountId: string,
	projectId: string,
): Promise<string> {
	const response = await frameIoApiRequest.call(
		context,
		'GET',
		`/v4/accounts/${accountId}/projects/${projectId}`,
	);
	const project = unwrapResponse(response);
	const rootFolderId = project.root_folder_id as string;
	if (!rootFolderId) {
		throw new NodeOperationError(context.getNode(), 'Project root folder ID not found');
	}
	return rootFolderId;
}

function pushResponse(
	returnData: INodeExecutionData[],
	response: IDataObject,
	itemIndex: number,
): void {
	const data = unwrapResponse(response);
	const items = Array.isArray(data) ? data : [data];
	for (const entry of items) {
		returnData.push({
			json: entry,
			pairedItem: { item: itemIndex },
		});
	}
}

async function handleList(
	context: IExecuteFunctions,
	itemIndex: number,
	endpoint: string,
): Promise<IDataObject[]> {
	const returnAll = context.getNodeParameter('returnAll', itemIndex, false) as boolean;
	if (returnAll) {
		return await frameIoApiRequestAllItems.call(context, 'GET', endpoint);
	}
	const limit = context.getNodeParameter('limit', itemIndex, 50) as number;
	const response = await frameIoApiRequest.call(context, 'GET', endpoint, {}, { page_size: limit });
	return ((response.data as IDataObject[]) ?? []) as IDataObject[];
}

export async function executeFrameIo(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];
	const resource = this.getNodeParameter('resource', 0) as string;
	const operation = this.getNodeParameter('operation', 0) as string;

	for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
		try {
			const accountId = this.getNodeParameter('accountId', itemIndex, '') as string;

			switch (resource) {
				case 'account': {
					if (operation === 'list') {
						const response = await frameIoApiRequest.call(this, 'GET', '/v4/accounts');
						const accounts = (response.data as IDataObject[]) ?? [];
						for (const account of accounts) {
							returnData.push({ json: account, pairedItem: { item: itemIndex } });
						}
					}
					break;
				}
				case 'workspace': {
					const workspaceId = this.getNodeParameter('workspaceId', itemIndex, '') as string;
					const additionalFields = this.getNodeParameter(
						'additionalFields',
						itemIndex,
						{},
					) as IDataObject;

					if (operation === 'list') {
						const workspaces = await handleList(
							this,
							itemIndex,
							`/v4/accounts/${accountId}/workspaces`,
						);
						for (const workspace of workspaces) {
							returnData.push({ json: workspace, pairedItem: { item: itemIndex } });
						}
					} else if (operation === 'get') {
						const response = await frameIoApiRequest.call(
							this,
							'GET',
							`/v4/accounts/${accountId}/workspaces/${workspaceId}`,
						);
						pushResponse(returnData, response, itemIndex);
					} else if (operation === 'create') {
						const response = await frameIoApiRequest.call(
							this,
							'POST',
							`/v4/accounts/${accountId}/workspaces`,
							buildDataBody(additionalFields),
						);
						pushResponse(returnData, response, itemIndex);
					} else if (operation === 'update') {
						const response = await frameIoApiRequest.call(
							this,
							'PATCH',
							`/v4/accounts/${accountId}/workspaces/${workspaceId}`,
							buildDataBody(additionalFields),
						);
						pushResponse(returnData, response, itemIndex);
					} else if (operation === 'delete') {
						await frameIoApiRequest.call(
							this,
							'DELETE',
							`/v4/accounts/${accountId}/workspaces/${workspaceId}`,
						);
						returnData.push({
							json: { success: true, workspaceId },
							pairedItem: { item: itemIndex },
						});
					}
					break;
				}
				case 'project': {
					const workspaceId = this.getNodeParameter('workspaceId', itemIndex) as string;
					const projectId = this.getNodeParameter('projectId', itemIndex, '') as string;
					const additionalFields = this.getNodeParameter(
						'additionalFields',
						itemIndex,
						{},
					) as IDataObject;

					if (operation === 'list') {
						const projects = await handleList(
							this,
							itemIndex,
							`/v4/accounts/${accountId}/workspaces/${workspaceId}/projects`,
						);
						for (const project of projects) {
							returnData.push({ json: project, pairedItem: { item: itemIndex } });
						}
					} else if (operation === 'get') {
						const response = await frameIoApiRequest.call(
							this,
							'GET',
							`/v4/accounts/${accountId}/projects/${projectId}`,
						);
						pushResponse(returnData, response, itemIndex);
					} else if (operation === 'create') {
						const response = await frameIoApiRequest.call(
							this,
							'POST',
							`/v4/accounts/${accountId}/workspaces/${workspaceId}/projects`,
							buildDataBody(additionalFields),
						);
						pushResponse(returnData, response, itemIndex);
					} else if (operation === 'update') {
						const response = await frameIoApiRequest.call(
							this,
							'PATCH',
							`/v4/accounts/${accountId}/projects/${projectId}`,
							buildDataBody(additionalFields),
						);
						pushResponse(returnData, response, itemIndex);
					} else if (operation === 'delete') {
						await frameIoApiRequest.call(
							this,
							'DELETE',
							`/v4/accounts/${accountId}/projects/${projectId}`,
						);
						returnData.push({
							json: { success: true, projectId },
							pairedItem: { item: itemIndex },
						});
					}
					break;
				}
				case 'folder': {
					const projectId = this.getNodeParameter('projectId', itemIndex) as string;
					const folderId = this.getNodeParameter('folderId', itemIndex) as string;
					const additionalFields = this.getNodeParameter(
						'additionalFields',
						itemIndex,
						{},
					) as IDataObject;

					if (operation === 'get') {
						const response = await frameIoApiRequest.call(
							this,
							'GET',
							`/v4/accounts/${accountId}/folders/${folderId}`,
						);
						pushResponse(returnData, response, itemIndex);
					} else if (operation === 'create') {
						let parentFolderId = this.getNodeParameter('parentFolderId', itemIndex, '') as string;
						if (!parentFolderId) {
							parentFolderId = await getProjectRootFolderId(this, accountId, projectId);
						}
						const response = await frameIoApiRequest.call(
							this,
							'POST',
							`/v4/accounts/${accountId}/folders/${parentFolderId}/folders`,
							buildDataBody(additionalFields),
						);
						pushResponse(returnData, response, itemIndex);
					} else if (operation === 'update') {
						const response = await frameIoApiRequest.call(
							this,
							'PATCH',
							`/v4/accounts/${accountId}/folders/${folderId}`,
							buildDataBody(additionalFields),
						);
						pushResponse(returnData, response, itemIndex);
					} else if (operation === 'delete') {
						await frameIoApiRequest.call(
							this,
							'DELETE',
							`/v4/accounts/${accountId}/folders/${folderId}`,
						);
						returnData.push({
							json: { success: true, folderId },
							pairedItem: { item: itemIndex },
						});
					} else if (operation === 'listChildren') {
						const childType = this.getNodeParameter('childType', itemIndex, 'both') as string;
						const children: IDataObject[] = [];
						if (childType === 'folders' || childType === 'both') {
							children.push(
								...(await handleList(
									this,
									itemIndex,
									`/v4/accounts/${accountId}/folders/${folderId}/folders`,
								)),
							);
						}
						if (childType === 'files' || childType === 'both') {
							children.push(
								...(await handleList(
									this,
									itemIndex,
									`/v4/accounts/${accountId}/folders/${folderId}/files`,
								)),
							);
						}
						for (const child of children) {
							returnData.push({ json: child, pairedItem: { item: itemIndex } });
						}
					}
					break;
				}
				case 'file': {
					const fileId = this.getNodeParameter('fileId', itemIndex) as string;
					const additionalFields = this.getNodeParameter(
						'additionalFields',
						itemIndex,
						{},
					) as IDataObject;

					if (operation === 'get') {
						const qs: IDataObject = {};
						if (additionalFields.include) {
							qs.include = additionalFields.include;
						}
						const response = await frameIoApiRequest.call(
							this,
							'GET',
							`/v4/accounts/${accountId}/files/${fileId}`,
							{},
							qs,
						);
						pushResponse(returnData, response, itemIndex);
					} else if (operation === 'update') {
						const { include: _include, ...updateFields } = additionalFields;
						const response = await frameIoApiRequest.call(
							this,
							'PATCH',
							`/v4/accounts/${accountId}/files/${fileId}`,
							buildDataBody(updateFields),
						);
						pushResponse(returnData, response, itemIndex);
					} else if (operation === 'delete') {
						await frameIoApiRequest.call(
							this,
							'DELETE',
							`/v4/accounts/${accountId}/files/${fileId}`,
						);
						returnData.push({
							json: { success: true, fileId },
							pairedItem: { item: itemIndex },
						});
					}
					break;
				}
				case 'comment': {
					const fileId = this.getNodeParameter('fileId', itemIndex, '') as string;
					const commentId = this.getNodeParameter('commentId', itemIndex, '') as string;
					const additionalFields = this.getNodeParameter(
						'additionalFields',
						itemIndex,
						{},
					) as IDataObject;

					if (operation === 'list') {
						const comments = await handleList(
							this,
							itemIndex,
							`/v4/accounts/${accountId}/files/${fileId}/comments`,
						);
						for (const comment of comments) {
							returnData.push({ json: comment, pairedItem: { item: itemIndex } });
						}
					} else if (operation === 'get') {
						const response = await frameIoApiRequest.call(
							this,
							'GET',
							`/v4/accounts/${accountId}/comments/${commentId}`,
						);
						pushResponse(returnData, response, itemIndex);
					} else if (operation === 'create') {
						const response = await frameIoApiRequest.call(
							this,
							'POST',
							`/v4/accounts/${accountId}/files/${fileId}/comments`,
							buildDataBody(additionalFields),
						);
						pushResponse(returnData, response, itemIndex);
					} else if (operation === 'update') {
						const response = await frameIoApiRequest.call(
							this,
							'PATCH',
							`/v4/accounts/${accountId}/comments/${commentId}`,
							buildDataBody(additionalFields),
						);
						pushResponse(returnData, response, itemIndex);
					} else if (operation === 'delete') {
						await frameIoApiRequest.call(
							this,
							'DELETE',
							`/v4/accounts/${accountId}/comments/${commentId}`,
						);
						returnData.push({
							json: { success: true, commentId },
							pairedItem: { item: itemIndex },
						});
					}
					break;
				}
				case 'versionStack': {
					const projectId = this.getNodeParameter('projectId', itemIndex) as string;
					const versionStackId = this.getNodeParameter('versionStackId', itemIndex) as string;
					const additionalFields = this.getNodeParameter(
						'additionalFields',
						itemIndex,
						{},
					) as IDataObject;

					if (operation === 'list') {
						const stacks = await handleList(
							this,
							itemIndex,
							`/v4/accounts/${accountId}/projects/${projectId}/version_stacks`,
						);
						for (const stack of stacks) {
							returnData.push({ json: stack, pairedItem: { item: itemIndex } });
						}
					} else if (operation === 'get') {
						const response = await frameIoApiRequest.call(
							this,
							'GET',
							`/v4/accounts/${accountId}/version_stacks/${versionStackId}`,
						);
						pushResponse(returnData, response, itemIndex);
					} else if (operation === 'create') {
						let parentFolderId = this.getNodeParameter('parentFolderId', itemIndex, '') as string;
						if (!parentFolderId) {
							parentFolderId = await getProjectRootFolderId(this, accountId, projectId);
						}
						const response = await frameIoApiRequest.call(
							this,
							'POST',
							`/v4/accounts/${accountId}/folders/${parentFolderId}/version_stacks`,
							buildDataBody(additionalFields),
						);
						pushResponse(returnData, response, itemIndex);
					} else if (operation === 'listChildren') {
						const children = await handleList(
							this,
							itemIndex,
							`/v4/accounts/${accountId}/version_stacks/${versionStackId}/files`,
						);
						for (const child of children) {
							returnData.push({ json: child, pairedItem: { item: itemIndex } });
						}
					} else if (operation === 'copy' || operation === 'move') {
						const destinationFolderId = this.getNodeParameter(
							'destinationFolderId',
							itemIndex,
						) as string;
						const response = await frameIoApiRequest.call(
							this,
							'POST',
							`/v4/accounts/${accountId}/version_stacks/${versionStackId}/${operation}`,
							buildDataBody({ destination_folder_id: destinationFolderId }),
						);
						pushResponse(returnData, response, itemIndex);
					}
					break;
				}
				case 'share': {
					const projectId = this.getNodeParameter('projectId', itemIndex) as string;
					const shareId = this.getNodeParameter('shareId', itemIndex, '') as string;
					const additionalFields = this.getNodeParameter(
						'additionalFields',
						itemIndex,
						{},
					) as IDataObject;

					if (operation === 'list') {
						const shares = await handleList(
							this,
							itemIndex,
							`/v4/accounts/${accountId}/projects/${projectId}/shares`,
						);
						for (const share of shares) {
							returnData.push({ json: share, pairedItem: { item: itemIndex } });
						}
					} else if (operation === 'get') {
						const response = await frameIoApiRequest.call(
							this,
							'GET',
							`/v4/accounts/${accountId}/shares/${shareId}`,
						);
						pushResponse(returnData, response, itemIndex);
					} else if (operation === 'create') {
						const response = await frameIoApiRequest.call(
							this,
							'POST',
							`/v4/accounts/${accountId}/projects/${projectId}/shares`,
							buildDataBody(additionalFields),
						);
						pushResponse(returnData, response, itemIndex);
					} else if (operation === 'update') {
						const response = await frameIoApiRequest.call(
							this,
							'PATCH',
							`/v4/accounts/${accountId}/shares/${shareId}`,
							buildDataBody(additionalFields),
						);
						pushResponse(returnData, response, itemIndex);
					} else if (operation === 'delete') {
						await frameIoApiRequest.call(
							this,
							'DELETE',
							`/v4/accounts/${accountId}/shares/${shareId}`,
						);
						returnData.push({
							json: { success: true, shareId },
							pairedItem: { item: itemIndex },
						});
					} else if (operation === 'addAsset') {
						const assetId = this.getNodeParameter('assetId', itemIndex) as string;
						const assetType = this.getNodeParameter('assetType', itemIndex) as string;
						const response = await frameIoApiRequest.call(
							this,
							'POST',
							`/v4/accounts/${accountId}/shares/${shareId}/assets`,
							buildDataBody({ id: assetId, type: assetType }),
						);
						pushResponse(returnData, response, itemIndex);
					} else if (operation === 'removeAsset') {
						const assetId = this.getNodeParameter('assetId', itemIndex) as string;
						await frameIoApiRequest.call(
							this,
							'DELETE',
							`/v4/accounts/${accountId}/shares/${shareId}/assets/${assetId}`,
						);
						returnData.push({
							json: { success: true, shareId, assetId },
							pairedItem: { item: itemIndex },
						});
					}
					break;
				}
				case 'webhook': {
					const workspaceId = this.getNodeParameter('workspaceId', itemIndex) as string;
					const webhookId = this.getNodeParameter('webhookId', itemIndex, '') as string;
					const additionalFields = this.getNodeParameter(
						'additionalFields',
						itemIndex,
						{},
					) as IDataObject;
					const webhookBody = { ...additionalFields };
					if (typeof webhookBody.events === 'string' && webhookBody.events) {
						webhookBody.events = (webhookBody.events as string)
							.split(',')
							.map((event) => event.trim())
							.filter(Boolean);
					}

					if (operation === 'list') {
						const webhooks = await handleList(
							this,
							itemIndex,
							`/v4/accounts/${accountId}/workspaces/${workspaceId}/webhooks`,
						);
						for (const webhook of webhooks) {
							returnData.push({ json: webhook, pairedItem: { item: itemIndex } });
						}
					} else if (operation === 'get') {
						const response = await frameIoApiRequest.call(
							this,
							'GET',
							`/v4/accounts/${accountId}/webhooks/${webhookId}`,
						);
						pushResponse(returnData, response, itemIndex);
					} else if (operation === 'create') {
						const response = await frameIoApiRequest.call(
							this,
							'POST',
							`/v4/accounts/${accountId}/workspaces/${workspaceId}/webhooks`,
							buildDataBody(webhookBody),
						);
						pushResponse(returnData, response, itemIndex);
					} else if (operation === 'update') {
						const response = await frameIoApiRequest.call(
							this,
							'PATCH',
							`/v4/accounts/${accountId}/webhooks/${webhookId}`,
							buildDataBody(webhookBody),
						);
						pushResponse(returnData, response, itemIndex);
					} else if (operation === 'delete') {
						await frameIoApiRequest.call(
							this,
							'DELETE',
							`/v4/accounts/${accountId}/webhooks/${webhookId}`,
						);
						returnData.push({
							json: { success: true, webhookId },
							pairedItem: { item: itemIndex },
						});
					}
					break;
				}
				case 'metadata': {
					const resourceType = this.getNodeParameter('resourceType', itemIndex) as string;
					const resourceId = this.getNodeParameter('resourceId', itemIndex) as string;
					const metadataValues = this.getNodeParameter('metadataValues', itemIndex) as
						| IDataObject
						| string;
					const parsedValues =
						typeof metadataValues === 'string' ? JSON.parse(metadataValues) : metadataValues;

					const response = await frameIoApiRequest.call(
						this,
						'PATCH',
						`/v4/accounts/${accountId}/${resourceType}s/${resourceId}/metadata`,
						buildDataBody({ metadata: parsedValues }),
					);
					pushResponse(returnData, response, itemIndex);
					break;
				}
				case 'collection': {
					const projectId = this.getNodeParameter('projectId', itemIndex) as string;
					const collectionId = this.getNodeParameter('collectionId', itemIndex, '') as string;
					const additionalFields = this.getNodeParameter(
						'additionalFields',
						itemIndex,
						{},
					) as IDataObject;

					if (operation === 'list') {
						const collections = await handleList(
							this,
							itemIndex,
							`/v4/accounts/${accountId}/projects/${projectId}/collections`,
						);
						for (const collection of collections) {
							returnData.push({ json: collection, pairedItem: { item: itemIndex } });
						}
					} else if (operation === 'get') {
						const response = await frameIoApiRequest.call(
							this,
							'GET',
							`/v4/accounts/${accountId}/collections/${collectionId}`,
						);
						pushResponse(returnData, response, itemIndex);
					} else if (operation === 'create') {
						const response = await frameIoApiRequest.call(
							this,
							'POST',
							`/v4/accounts/${accountId}/projects/${projectId}/collections`,
							buildDataBody(additionalFields),
						);
						pushResponse(returnData, response, itemIndex);
					} else if (operation === 'update') {
						const response = await frameIoApiRequest.call(
							this,
							'PATCH',
							`/v4/accounts/${accountId}/collections/${collectionId}`,
							buildDataBody(additionalFields),
						);
						pushResponse(returnData, response, itemIndex);
					} else if (operation === 'delete') {
						await frameIoApiRequest.call(
							this,
							'DELETE',
							`/v4/accounts/${accountId}/collections/${collectionId}`,
						);
						returnData.push({
							json: { success: true, collectionId },
							pairedItem: { item: itemIndex },
						});
					}
					break;
				}
				case 'customField': {
					const projectId = this.getNodeParameter('projectId', itemIndex) as string;
					const customFieldId = this.getNodeParameter('customFieldId', itemIndex, '') as string;
					const additionalFields = this.getNodeParameter(
						'additionalFields',
						itemIndex,
						{},
					) as IDataObject;

					if (operation === 'list') {
						const fields = await handleList(
							this,
							itemIndex,
							`/v4/accounts/${accountId}/projects/${projectId}/custom_fields`,
						);
						for (const field of fields) {
							returnData.push({ json: field, pairedItem: { item: itemIndex } });
						}
					} else if (operation === 'get') {
						const response = await frameIoApiRequest.call(
							this,
							'GET',
							`/v4/accounts/${accountId}/custom_fields/${customFieldId}`,
						);
						pushResponse(returnData, response, itemIndex);
					} else if (operation === 'create') {
						const response = await frameIoApiRequest.call(
							this,
							'POST',
							`/v4/accounts/${accountId}/projects/${projectId}/custom_fields`,
							buildDataBody(additionalFields),
						);
						pushResponse(returnData, response, itemIndex);
					} else if (operation === 'update') {
						const response = await frameIoApiRequest.call(
							this,
							'PATCH',
							`/v4/accounts/${accountId}/custom_fields/${customFieldId}`,
							buildDataBody(additionalFields),
						);
						pushResponse(returnData, response, itemIndex);
					} else if (operation === 'delete') {
						await frameIoApiRequest.call(
							this,
							'DELETE',
							`/v4/accounts/${accountId}/custom_fields/${customFieldId}`,
						);
						returnData.push({
							json: { success: true, customFieldId },
							pairedItem: { item: itemIndex },
						});
					}
					break;
				}
				case 'permission': {
					const permissionScope = this.getNodeParameter('permissionScope', itemIndex) as string;
					const workspaceId = this.getNodeParameter('workspaceId', itemIndex, '') as string;
					const projectId = this.getNodeParameter('projectId', itemIndex, '') as string;

					if (operation === 'listUsers') {
						const endpoint =
							permissionScope === 'workspace'
								? `/v4/accounts/${accountId}/workspaces/${workspaceId}/users`
								: `/v4/accounts/${accountId}/projects/${projectId}/users`;
						const users = await handleList(this, itemIndex, endpoint);
						for (const user of users) {
							returnData.push({ json: user, pairedItem: { item: itemIndex } });
						}
					} else if (operation === 'updateUserRole') {
						const userId = this.getNodeParameter('userId', itemIndex) as string;
						const role = this.getNodeParameter('role', itemIndex) as string;
						const endpoint =
							permissionScope === 'workspace'
								? `/v4/accounts/${accountId}/workspaces/${workspaceId}/users/${userId}`
								: `/v4/accounts/${accountId}/projects/${projectId}/users/${userId}`;
						const response = await frameIoApiRequest.call(
							this,
							'PATCH',
							endpoint,
							buildDataBody({ role }),
						);
						pushResponse(returnData, response, itemIndex);
					}
					break;
				}
				default:
					throw new NodeOperationError(
						this.getNode(),
						`The resource "${resource}" is not supported`,
					);
			}
		} catch (error) {
			if (this.continueOnFail()) {
				returnData.push({
					json: { error: (error as Error).message },
					pairedItem: { item: itemIndex },
				});
				continue;
			}
			throw error;
		}
	}

	return returnData;
}
