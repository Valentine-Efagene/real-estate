import { readFileSync, readdirSync, statSync, promises, constants } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class FileSystemHelper {
    private static root: string = path.join(__dirname, '../templates/');

    public static async getFilePath(fileName: string): Promise<string> {
        const filePath = path.join(this.root, fileName);
        return filePath;
    }

    public static async checkFileExists(fileName: string): Promise<boolean> {
        const filePath = path.join(this.root, fileName);

        try {
            await promises.access(`${filePath}`, constants.F_OK);
            console.log({ filePath, found: true });
            return true;
        } catch (error) {
            console.log({ filePath, found: false });
            return false;
        }
    }

    public static loadFileWithFullPath(filePath: string): string {
        const fileContent = readFileSync(filePath, 'utf-8');
        return fileContent;
    }

    public static loadFile(fileName: string): string {
        const filePath = path.join(this.root, fileName);
        const fileContent = readFileSync(filePath, 'utf-8');
        return fileContent;
    }

    public static async splitFilePath(filePath: string) {
        let normalizedPath = path.normalize(filePath);
        normalizedPath = normalizedPath.replaceAll('\\', '/');

        const fileName = path.basename(normalizedPath);
        const directoryPath = path.dirname(normalizedPath);
        const extension = path.extname(fileName);
        const folderArray = directoryPath.split('/');
        const folderPath = folderArray.join('/');

        return {
            folderArray,
            folderPath,
            fileName,
            extension
        };
    }

    public static loadTemplate(fileName: string): string {
        const filePath = path.join(this.root, `${fileName}`);
        const fileContent = readFileSync(filePath, 'utf-8');
        return fileContent;
    }

    public static listHtmlFilesInTemplates(): string[] {
        const htmlFiles: string[] = [];

        const getFilesRecursively = (dir: string) => {
            try {
                const files = readdirSync(dir);

                files.forEach(file => {
                    const fullPath = path.join(dir, file);
                    const relativePath = path.relative(this.root, fullPath);

                    if (statSync(fullPath).isDirectory()) {
                        getFilesRecursively(fullPath);
                    } else if (file.endsWith('.html')) {
                        htmlFiles.push(relativePath);
                    }
                });
            } catch (error) {
                console.log(error);
                throw error;
            }
        };

        getFilesRecursively(this.root);

        return htmlFiles;
    }
}
