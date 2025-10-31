import { Injectable } from '@nestjs/common';
import * as fastcsv from 'fast-csv';

@Injectable()
export class CsvService {
    async parseCsv<T>(file: Express.Multer.File): Promise<T[]> {
        return new Promise((resolve, reject) => {
            const results: T[] = [];

            // Handle real Buffer vs serialized buffer object
            const buffer =
                file.buffer instanceof Buffer
                    ? file.buffer
                    : Buffer.from((file.buffer as any).data);

            fastcsv
                .parseString(buffer.toString(), { headers: true, trim: true })
                .on('error', (error) => reject(error))
                .on('data', (row) => {
                    results.push(row);
                })
                .on('end', () => {
                    resolve(results);
                });
        });
    }
}
