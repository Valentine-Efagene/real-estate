export const mockS3UploaderService = {
    uploadFileToS3: jest.fn().mockResolvedValue('https://yts.mx/movies/happiness-is-a-warm-blanket-charlie-brown-2011'),
    uploadImageToS3: jest.fn().mockResolvedValue('https://yts.mx/movies/happiness-is-a-warm-blanket-charlie-brown-2011'),
    replaceFileOnS3: jest.fn().mockResolvedValue('https://yts.mx/movies/happiness-is-a-warm-blanket-charlie-brown-2011'),
    replaceImageOnS3: jest.fn().mockResolvedValue('https://yts.mx/movies/happiness-is-a-warm-blanket-charlie-brown-2011'),
    deleteFromS3: jest.fn().mockResolvedValue(undefined),
    uploadBase64ImageToS3: jest.fn().mockImplementation((_: string, key: string) => {
        const url = `https://mediacraft.s3.amazonaws.com/${key}`
        return Promise.resolve(url)
    }),
}