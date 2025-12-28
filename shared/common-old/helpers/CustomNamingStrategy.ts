import { DefaultNamingStrategy, NamingStrategyInterface } from 'typeorm';

export class CustomNamingStrategy
  extends DefaultNamingStrategy
  implements NamingStrategyInterface {
  tableName(className: string, customName: string): string {
    return customName ? customName : this.snakeCase(className);
  }

  columnName(
    propertyName: string,
    customName: string,
    //embeddedPrefixes: string[],
  ): string {
    return customName ? customName : this.snakeCase(propertyName);
  }

  relationName(propertyName: string): string {
    return this.snakeCase(propertyName);
  }

  private snakeCase(name: string): string {
    return name
      .replace(/([A-Z])/g, (match) => `_${match.toLowerCase()}`)
      .replace(/^_/, '');
  }
}
