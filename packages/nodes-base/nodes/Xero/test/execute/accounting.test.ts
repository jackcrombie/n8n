import { mock, mockDeep } from 'jest-mock-extended';
import type { IExecuteFunctions, INode } from 'n8n-workflow';

import { XERO_ACCOUNTING_BASE_URL } from '../../GenericFunctions';
import { Xero } from '../../Xero.node';

describe('Xero Node accounting regression', () => {
	let xero: Xero;
	let mockExecuteFunctions: jest.Mocked<IExecuteFunctions>;
	let mockRequestOAuth2: jest.Mock;

	beforeEach(() => {
		xero = new Xero();
		mockExecuteFunctions = mockDeep<IExecuteFunctions>();
		mockRequestOAuth2 = jest.fn();
		mockExecuteFunctions.helpers.requestOAuth2 = mockRequestOAuth2;
		mockExecuteFunctions.getNode.mockReturnValue(
			mock<INode>({ name: 'Xero', type: 'n8n-nodes-base.xero' }),
		);
		mockExecuteFunctions.getInputData.mockReturnValue([{ json: {} }]);
		mockExecuteFunctions.continueOnFail.mockReturnValue(false);
		mockExecuteFunctions.helpers.constructExecutionMetaData.mockImplementation((items, meta) =>
			items.map((item, index) => ({
				json: item,
				pairedItem: { item: meta?.itemData?.item ?? index },
			})),
		);
		mockExecuteFunctions.helpers.returnJsonArray.mockImplementation((data) =>
			Array.isArray(data) ? data : [data],
		);
		jest.clearAllMocks();
	});

	it('should get a single invoice from the accounting API', async () => {
		mockExecuteFunctions.getNodeParameter.mockImplementation((parameterName: string) => {
			const parameters: Record<string, unknown> = {
				resource: 'invoice',
				operation: 'get',
				organizationId: 'tenant-123',
				invoiceId: 'invoice-456',
			};
			return parameters[parameterName];
		});
		mockRequestOAuth2.mockResolvedValue({
			Invoices: [
				{
					InvoiceID: 'invoice-456',
					InvoiceNumber: 'INV-001',
					Type: 'ACCREC',
					Status: 'AUTHORISED',
				},
			],
		});

		const result = await xero.execute.call(mockExecuteFunctions);

		expect(mockRequestOAuth2).toHaveBeenCalledWith(
			'xeroOAuth2Api',
			expect.objectContaining({
				method: 'GET',
				uri: `${XERO_ACCOUNTING_BASE_URL}/Invoices/invoice-456`,
				headers: expect.objectContaining({
					'Xero-tenant-id': 'tenant-123',
				}),
			}),
		);
		expect(result[0]).toEqual([
			{
				json: {
					InvoiceID: 'invoice-456',
					InvoiceNumber: 'INV-001',
					Type: 'ACCREC',
					Status: 'AUTHORISED',
				},
				pairedItem: { item: 0 },
			},
		]);
	});

	it('should get many contacts from the accounting API with pagination', async () => {
		mockExecuteFunctions.getNodeParameter.mockImplementation((parameterName: string) => {
			const parameters: Record<string, unknown> = {
				resource: 'contact',
				operation: 'getAll',
				organizationId: 'tenant-123',
				returnAll: false,
				limit: 1,
				options: {},
			};
			return parameters[parameterName];
		});
		mockRequestOAuth2.mockResolvedValue({
			Contacts: [
				{ ContactID: 'contact-1', Name: 'Acme' },
				{ ContactID: 'contact-2', Name: 'Globex' },
			],
		});

		const result = await xero.execute.call(mockExecuteFunctions);

		expect(mockRequestOAuth2).toHaveBeenCalledWith(
			'xeroOAuth2Api',
			expect.objectContaining({
				method: 'GET',
				uri: `${XERO_ACCOUNTING_BASE_URL}/Contacts`,
				headers: expect.objectContaining({
					'Xero-tenant-id': 'tenant-123',
				}),
			}),
		);
		expect(result[0]).toEqual([
			{
				json: { ContactID: 'contact-1', Name: 'Acme' },
				pairedItem: { item: 0 },
			},
		]);
	});

	it('should create a contact via POST /Contacts', async () => {
		mockExecuteFunctions.getNodeParameter.mockImplementation(
			(parameterName: string, itemIndex?: number) => {
				if (parameterName === 'additionalFields' || parameterName === 'updateFields') {
					return {};
				}

				const parameters: Record<string, unknown> = {
					resource: 'contact',
					operation: 'create',
					organizationId: 'tenant-123',
					name: 'New Contact',
				};
				return parameters[parameterName];
			},
		);
		mockRequestOAuth2.mockResolvedValue({
			Contacts: [{ ContactID: 'contact-new', Name: 'New Contact' }],
		});

		const result = await xero.execute.call(mockExecuteFunctions);

		expect(mockRequestOAuth2).toHaveBeenCalledWith(
			'xeroOAuth2Api',
			expect.objectContaining({
				method: 'POST',
				uri: `${XERO_ACCOUNTING_BASE_URL}/Contacts`,
				body: {
					Contacts: [{ Name: 'New Contact' }],
				},
				headers: expect.objectContaining({
					'Xero-tenant-id': 'tenant-123',
				}),
			}),
		);
		expect(result[0][0].json).toEqual({
			ContactID: 'contact-new',
			Name: 'New Contact',
		});
	});
});
