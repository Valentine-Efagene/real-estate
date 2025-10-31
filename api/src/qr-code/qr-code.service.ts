import { BadRequestException, Injectable } from "@nestjs/common";
import { EncryptionService } from "../encryption/encryption.service";
import * as QRCode from "qrcode";
import * as crypto from "crypto";
import { Ticket } from "src/ticket/ticket.entity";

@Injectable()
export class QrCodeService {
  constructor(private readonly encryptionService: EncryptionService) { }

  generateNonce(): string {
    return crypto.randomBytes(8).toString('hex')
  }

  async convertToImage(encryptedText: string): Promise<string> {
    try {
      return QRCode.toDataURL(encryptedText);
    } catch (err) {
      throw new BadRequestException('Failed to generate QR code image');
    }
  }

  /**
   * Generate just the encrypted string (not image)
   */
  encryptPayload(payload: IQRPayload): string {
    const json = JSON.stringify(payload);
    return this.encryptionService.encrypt(json);
  }

  /**
   * Parse and decrypt encrypted string scanned from QR code
   * Most scanners give you the original encrypted string, not the base64 image.
   */
  parseEncryptedText(qrEncryptedText: string): IQRPayload {
    try {
      const decrypted = this.encryptionService.decrypt(qrEncryptedText);
      const parsed = JSON.parse(decrypted);

      if (
        typeof parsed.ticketId !== 'number' ||
        typeof parsed.userId !== 'number' ||
        typeof parsed.issuedAt !== 'number'
      ) {
        throw new Error('Invalid QR payload structure');
      }

      return parsed;
    } catch (err) {
      throw new BadRequestException('Invalid or malformed QR code');
    }
  }

  /**
   * Validate the QR nonce with DB version
   */
  validate(qrCode: string, ticket: Ticket) {
    const { nonce } = this.parseEncryptedText(qrCode);

    if (!nonce) {
      throw new BadRequestException('QR code is missing nonce');
    }

    if (nonce !== ticket.nonce) {
      throw new BadRequestException('QR code is invalid or has been reused');
    }
  }
}
