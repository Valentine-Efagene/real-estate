let emailVerificationToken: string | null = null

export function getEmailVerificationToken() {
    return emailVerificationToken
}

export const mockMailService = {
    sendMail: jest.fn().mockResolvedValue(true),
    sendPaymentReminder: jest.fn().mockResolvedValue(true),
    sendEmailVerification: jest.fn().mockImplementation(({ link }) => {
        const url = new URL(`http://${link}`) // add http to use URL API
        emailVerificationToken = url.searchParams.get('token')
        return Promise.resolve()
    }),
}