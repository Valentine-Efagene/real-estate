export default class StringHelper {
  public static deNull(value?: string | null, defaultValue?: string | null) {
    if (!value || value === "") return defaultValue ?? "";

    return value;
  }

  public static dotSeparate(texts: string[]) {
    return texts.join(" • ");
  }

  public static stripUnderscores(value?: string | null) {
    if (!value || value.length < 2) return value;

    const lowercase = value.toLocaleLowerCase()

    const valArr = lowercase.split("_");
    const capped = valArr.map(
      (val) => `${val[0].toUpperCase()}${val.slice(1)}`
    );

    return capped.join(" ");
  }

  public static stripHyphens(value?: string | null) {
    if (!value || value.length < 2) return value;

    const valArr = value.split("-");
    const capped = valArr.map(
      (val) => `${val[0].toUpperCase()}${val.slice(1)}`
    );
    return capped.join(" ");
  }

  public static toTitleCase(str: string | null | undefined): string | null {
    if (!str) {
      return null
    }

    return str
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  public static toSentenceCase(value?: string | null) {
    if (!value || value.length < 1) return value;

    // Convert the entire string to lowercase first
    const lowerCased = value.toLowerCase();

    // Capitalize the first letter of the string
    return lowerCased[0].toUpperCase() + lowerCased.slice(1);
  }

  public static parseDate(isoString?: string | null) {
    if (!isoString) return "";

    return new Date(isoString).toLocaleDateString();
  }

  public static camelCaseToSentenceCase(input?: string | null) {
    if (!input || input.length < 1) return input;

    // Add space before uppercase letters and convert to lowercase
    return input.replace(/([A-Z])/g, " $1").toLowerCase();
  }

  public static camelCaseToTitleCase(inputString?: string | null) {
    if (!inputString || inputString.length < 1) return inputString;

    // Add a space before each capital letter
    const titleCaseString = inputString.replace(/([A-Z])/g, " $1");

    // Capitalize the first character and trim any leading spaces
    return (
      titleCaseString.charAt(0).toUpperCase() + titleCaseString.slice(1).trim()
    );
  }

  public static convertTo12Hour(hour: number): string {
    if (hour < 0 || hour > 23) {
      throw new Error("Invalid hour. Hour should be between 0 and 23.");
    }

    const period = hour < 12 ? "AM" : "PM";
    const adjustedHour = hour % 12 === 0 ? 12 : hour % 12;

    return `${adjustedHour} ${period}`;
  }
}
