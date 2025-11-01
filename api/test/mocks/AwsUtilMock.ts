export default class AwsUtil {
    private static bucketName = process.env.AWS_S3_BUCKET_NAME || 'test-bucket';

    public static async splitFilePath(filePath: string) {
        const normalizedPath = (filePath || '').replaceAll('\\\\', '/');
        const fileName = normalizedPath.split('/').pop() || '';
        const extension = fileName.includes('.') ? `.${fileName.split('.').pop()}` : '';
        const directoryPath = normalizedPath.split('/').slice(0, -1).join('/');
        const folderArray = directoryPath ? directoryPath.split('/') : [];
        const folderPath = folderArray.join('/');

        return { folderArray, folderPath, fileName, extension };
    }

    public static async buildKey(filePath: string): Promise<string> {
        const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
        const uniqueFileName = `mock-${timestamp}`;
        const key = `${filePath}/${uniqueFileName}`;
        return key;
    }

    public static async uploadToS3(
        _file: any,
        folder: string,
        fileName: string,
        _fileType: string,
        _transform: (file) => Promise<Buffer>,
    ) {
        return `https://${this.bucketName}.s3.amazonaws.com/${folder}/${fileName}`;
    }

    public static async deleteFromS3(_key: string) {
        return {};
    }

    public static async uploadImageToS3(file: any, folder: string, fileName: string, fileType: string) {
        return this.uploadToS3(file, folder, fileName, fileType, async (f) => f);
    }

    public static async uploadFileToS3(file: any, folder: string, fileName: string, fileType: string) {
        return this.uploadToS3(file, folder, fileName, fileType, async (f) => f);
    }

    public static createPresignedUrl = async (url: string) => url;

    public static createPresignedUrlFromKey = async (key: string) => `https://mock.s3/${key}`;

    public static getKeyFromUrl = (url: string) => url.split('amazonaws.com/').at(-1) || url;

    public static async createPresignedPost(_key: string) {
        return { url: 'https://mock-presigned-url/', fields: {} };
    }

    public static async getObject(_key: string) {
        return { Body: null };
    }

    public static async uploadStream(_key: string, _fileStream: any, _contentType: string = 'application/octet-stream') {
        return;
    }
}
