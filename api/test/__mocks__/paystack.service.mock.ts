export const mockPaystackService = {
    initializeTransaction: jest.fn().mockImplementation((email: string,
        amount: number,
        reference: string,
        callbackUrl: string,
        metadata?: Record<string, any>,) => {
        return Promise.resolve({
            status: true,
            message: 'Authorization URL created',
            data: {
                authorization_url: 'https://checkout.paystack.com/b2oopalfa7fgiqc',
                access_code: 'b2oopalfa7fgiqc',
                reference
            }
        })
    }),
}