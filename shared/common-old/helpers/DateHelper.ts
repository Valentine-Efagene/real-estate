import { BadRequestException } from '@nestjs/common';

export default class DateHelper {
  public static formatDateToYYYYMMDD(dateString: string) {
    try {
      const date = new Date(dateString);

      // Ensure the input is a valid Date object
      if (!(date instanceof Date)) {
        throw new BadRequestException('Invalid date');
      }

      // Format the date using the formatter
      const formattedDate = date.toISOString().split('T')[0];

      return formattedDate;
    } catch (error) {
      throw new BadRequestException('Invalid date');
    }
  }
}
