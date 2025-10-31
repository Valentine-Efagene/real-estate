import { Logger } from "@nestjs/common";
import { Transform, TransformCallback } from "node:stream";

export class ByteLogger extends Transform {
    private readonly logger: Logger = new Logger(ByteLogger.name);
    private bytesTransferred = 0;

    _transform(chunk: Buffer, encoding: BufferEncoding, callback: TransformCallback) {
        this.bytesTransferred += chunk.length;
        this.logger.log(`Transferred ${chunk.length} bytes. Total: ${this.bytesTransferred} bytes.`);
        this.push(chunk); // Pass data along
        callback();
    }
}