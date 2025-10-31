import { BadRequestException } from '@nestjs/common';

export default class FolderResolver {
  public static folderMap: Record<string, string> = {
    'developer/logo': 'developer/logo',
    'developer/documents': 'developer/documents',
  };

  public static resolve(path: string) {
    const folder = this.folderMap[path];

    if (!folder) {
      throw new BadRequestException('Invalid path');
    }

    return folder;
  }
}
