import { ParseFileOptions, ParseFilePipe, PipeTransform } from "@nestjs/common";

export default class OptionalFilePipe implements PipeTransform {
    constructor(private options: ParseFileOptions) { }

    transform(value: any) {
        if (!value) {
            // If no file is provided, skip validation
            return value;
        }
        // Perform the regular validation
        return new ParseFilePipe(this.options).transform(value);
    }
}