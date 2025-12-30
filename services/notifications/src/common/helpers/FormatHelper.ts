function formatDate(isoDateString: string) {
  const date = new Date(isoDateString);

  // Format the date using the options
  const formattedDate = date.toLocaleDateString("en-GR", {
    month: "short",
    year: "numeric",
    // hour: 'numeric', // Display hours in numeric format (e.g., 1, 2, 3)
    // minute: 'numeric', // Display minutes in numeric format (e.g., 01, 02, 03)
    // second: 'numeric', // Display seconds in numeric format (e.g., 01, 02, 03)
    hour12: true,
  });

  // Get the day of the month and add the appropriate suffix (e.g., 1st, 2nd, 3rd)
  const day = date.getDate();
  const daySuffix = getDaySuffix(day);

  // Construct the final formatted date
  const finalFormattedDate = `${day}${daySuffix} ${formattedDate}`;

  return finalFormattedDate;
}

function getDaySuffix(day: number) {
  if (day >= 11 && day <= 13) {
    return "th";
  }

  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

class NairaFormatter {
  public format(value?: number | null) {
    if (value == null) {
      return 'N/A'
    }

    if (isNaN(value)) {
      return 'N/A'
    }

    try {
      return `₦${new Intl.NumberFormat("en-US", {
        style: "decimal",
      }).format(value ? value : 0)}`;
    } catch (error) {
      return value ? value : 'N/A'
    }
  }
}

class DateFormatter {
  public format(value: string | null) {
    if (value == null) return "N/A";

    return formatDate(value);
  }
}

class DateTimeFormatter {
  public format(value: string | number | Date | string | null) {
    if (value == null) return "N/A";

    const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      timeZone: 'UTC'
    });

    if (typeof value === 'string') {
      return dateTimeFormatter.format(new Date(value))
    }

    return dateTimeFormatter.format(value);
  }
}

export default class FormatHelper {
  public static readonly NAIRA_SYMBOL = '₦';

  public static percentageFormatter = new Intl.NumberFormat("en-GB", { style: "percent" });
  public static dateFormatter = new DateFormatter();
  public static dateTimeFormatter = new DateTimeFormatter()

  public static numberFormatter = new Intl.NumberFormat("en-GB");
  public static nairaFormatter = new NairaFormatter();
  public static dollarFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
}
