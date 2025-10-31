import { v4 as uuidv4 } from 'uuid';
import { extname } from 'path';
import Jimp from 'jimp';
//import sharp from 'sharp';

export default class ImageUtil {
  // public static async resizeImage(
  //   file: any,
  //   width: number = 1000,
  // ): Promise<Buffer> {
  //   return sharp(file.buffer).resize(width).toBuffer();
  // }

  public static async resizeImage(
    file: any,
    width: number = 1000,
  ): Promise<Buffer> {
    try {
      const image = await Jimp.read(file.buffer);
      const height = (image.getHeight() * width) / image.getWidth();
      return await image.resize(width, height).getBufferAsync(file.mimetype); // Modify format as needed
    } catch (error) {
      console.error('Error resizing image:', error);
      throw new Error('Failed to resize image'); // Handle the error appropriately
    }
  }

  public static customFilename(file) {
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
    const uniqueFileName = `${uuidv4()}-${timestamp}.${extname(
      file.originalname,
    )}`;

    return uniqueFileName;
  }
}
