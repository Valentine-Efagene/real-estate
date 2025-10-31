import { CsvService } from './csv.service';
import { readFileSync } from 'fs';
import * as path from 'path'

describe('CsvService', () => {
    let service: CsvService;

    beforeEach(() => {
        service = new CsvService();
    });

    it('should parse a valid CSV mock file into objects', async () => {
        const filePath = path.resolve(__dirname, '../../test/', '__fixtures__/sample.csv')

        // Mock Multer.File
        const mockFile: Express.Multer.File = {
            fieldname: 'file',
            originalname: 'test.csv',
            encoding: '7bit',
            mimetype: 'text/csv',
            buffer: readFileSync(filePath),
            size: readFileSync(filePath).length,
            stream: null as any,
            destination: '',
            filename: '',
            path: '',
        };

        const result = await service.parseCsv<{ email: string; phone: string; firstName: string }>(mockFile);

        expect(result).toBeDefined();
    });

    it('should parse a valid CSV file into objects', async () => {
        const csvContent = `email,phone,firstName
test1@example.com,1234567890,John
test2@example.com,0987654321,Jane`;

        // Mock Multer.File
        const mockFile: Express.Multer.File = {
            fieldname: 'file',
            originalname: 'test.csv',
            encoding: '7bit',
            mimetype: 'text/csv',
            buffer: Buffer.from(csvContent),
            size: csvContent.length,
            stream: null as any,
            destination: '',
            filename: '',
            path: '',
        };

        const result = await service.parseCsv<{ email: string; phone: string; firstName: string }>(mockFile);

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({
            email: 'test1@example.com',
            phone: '1234567890',
            firstName: 'John',
        });
        expect(result[1]).toEqual({
            email: 'test2@example.com',
            phone: '0987654321',
            firstName: 'Jane',
        });
    });

    it('should reject on invalid CSV', async () => {
        const invalidCsv = `email,phone,firstName
test1@example.com,1234567890`; // missing firstName

        const mockFile: Express.Multer.File = {
            fieldname: 'file',
            originalname: 'bad.csv',
            encoding: '7bit',
            mimetype: 'text/csv',
            buffer: Buffer.from(invalidCsv),
            size: invalidCsv.length,
            stream: null as any,
            destination: '',
            filename: '',
            path: '',
        };

        await expect(service.parseCsv(mockFile)).resolves.toBeDefined();
    });
});
