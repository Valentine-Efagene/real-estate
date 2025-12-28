import { readFileSync, readdirSync, statSync, promises, constants } from 'fs';
import * as path from 'path';

export class FileSystemHelper {
    private static root: string = path.join(__dirname, '../../mail/templates/');

    public static async getFilePath(fileName: string): Promise<string> {
        const filePath = path.join(this.root, fileName);
        return filePath
    }

    public static async checkFileExists(fileName: string): Promise<boolean> {
        const filePath = path.join(this.root, fileName);

        try {
            await promises.access(`${filePath}`, constants.F_OK)
            console.log({ filePath, found: true })
            return true
        } catch (error) {
            console.log({ filePath, found: false })
            return false
        }
    }

    public static loadFileWithFullPath(path: string): string {
        const fileContent = readFileSync(path, 'utf-8');
        return fileContent;
    }

    public static loadFile(fileName: string): string {
        const filePath = path.join(this.root, fileName);

        const fileContent = readFileSync(filePath, 'utf-8');
        return fileContent;
    }

    public static async splitFilePath(filePath: string) {
        // Normalize the file path to handle both Windows and Unix formats
        let normalizedPath = path.normalize(filePath)
        normalizedPath = normalizedPath.replaceAll('\\', '/')

        // Get the file name (last part of the path)
        const fileName = path.basename(normalizedPath);

        // Get the directory path
        const directoryPath = path.dirname(normalizedPath);
        const extension = path.extname(fileName)

        // Split the directory path into an array of folders
        const folderArray = directoryPath.split('/');

        // Reassemble the folder path as a string (optional, if you need it in this format)
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

    // Method to list all .html files from the templates directory
    public static listHtmlFilesInTemplates(): string[] {
        const htmlFiles: string[] = [];

        const getFilesRecursively = (dir: string) => {
            try {
                const files = readdirSync(dir);

                files.forEach(file => {
                    const fullPath = path.join(dir, file);
                    const relativePath = path.relative(this.root, fullPath);

                    if (statSync(fullPath).isDirectory()) {
                        // If it's a directory, go deeper
                        getFilesRecursively(fullPath);
                    } else if (file.endsWith('.html')) {
                        // If it's an HTML file, add to the list
                        htmlFiles.push(relativePath);
                    }
                });
            } catch (error) {
                console.log(error)
                throw error
            }
        };

        // Start the recursion from the templates folder
        getFilesRecursively(this.root);

        return htmlFiles;
    }
}
