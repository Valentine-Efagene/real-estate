import { Body, Controller, Get, HttpStatus, Param, Res } from '@nestjs/common';
import { AppService } from './app.service';
import { Response } from 'express';
import { QrCodeService } from './qr-code/qr-code.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly qrCodeService: QrCodeService,
  ) { }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('qr/:code')
  async testTicketQR(
    @Param('code') code: string,
    @Res() res: Response,
  ) {
    const qrCode = await this.qrCodeService.convertToImage(code);
    console.log(qrCode)

    if (!qrCode) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Failed to generate QR code');
    }

    res.setHeader('Content-Type', 'image/png');
    return res.send(qrCode);
  }
}
