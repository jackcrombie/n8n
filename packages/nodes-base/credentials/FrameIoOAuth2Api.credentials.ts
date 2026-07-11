import type { ICredentialTestRequest, ICredentialType, INodeProperties } from 'n8n-workflow';

const defaultScopes = 'openid email profile offline_access additional_info.roles';

export class FrameIoOAuth2Api implements ICredentialType {
	name = 'frameIoOAuth2Api';

	extends = ['oAuth2Api'];

	displayName = 'Frame.io OAuth2 API';

	documentationUrl = 'frameIo';

	properties: INodeProperties[] = [
		{
			displayName: 'Grant Type',
			name: 'grantType',
			type: 'hidden',
			default: 'authorizationCode',
		},
		{
			displayName: 'Authorization URL',
			name: 'authUrl',
			type: 'hidden',
			default: 'https://ims-na1.adobelogin.com/ims/authorize/v2',
			required: true,
		},
		{
			displayName: 'Access Token URL',
			name: 'accessTokenUrl',
			type: 'hidden',
			default: 'https://ims-na1.adobelogin.com/ims/token/v3',
			required: true,
		},
		{
			displayName: 'Auth URI Query Parameters',
			name: 'authQueryParameters',
			type: 'hidden',
			default: '',
		},
		{
			displayName: 'Authentication',
			name: 'authentication',
			type: 'hidden',
			default: 'header',
		},
		{
			displayName: 'Custom Scopes',
			name: 'customScopes',
			type: 'boolean',
			default: false,
			description: 'Whether to define custom OAuth2 scopes instead of the defaults',
		},
		{
			displayName:
				'The default scopes needed for the node to work are already set. If you change these the node may not function correctly.',
			name: 'customScopesNotice',
			type: 'notice',
			default: '',
			displayOptions: {
				show: {
					customScopes: [true],
				},
			},
		},
		{
			displayName: 'Enabled Scopes',
			name: 'enabledScopes',
			type: 'string',
			displayOptions: {
				show: {
					customScopes: [true],
				},
			},
			default: defaultScopes,
			description: 'Space-delimited list of Adobe IMS OAuth2 scopes to request',
		},
		{
			displayName: 'Scope',
			name: 'scope',
			type: 'hidden',
			default: `={{$self["customScopes"] ? $self["enabledScopes"] : "${defaultScopes}"}}`,
			required: true,
		},
	];

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.frame.io',
			url: '/v4/me',
		},
	};
}
