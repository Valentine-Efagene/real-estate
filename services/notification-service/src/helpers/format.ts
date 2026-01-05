/**
 * Cached Intl formatters for better performance
 * Creating Intl objects is expensive, so we cache them
 */

// Naira currency formatter
const nairaFormatter = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
});

// Date formatter (date only)
const dateFormatter = new Intl.DateTimeFormat('en-NG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
});

// DateTime formatter (date and time)
const dateTimeFormatter = new Intl.DateTimeFormat('en-NG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
});

// Short date formatter
const shortDateFormatter = new Intl.DateTimeFormat('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
});

// ISO date formatter
const isoDateFormatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});

/**
 * Format a number as Nigerian Naira currency
 */
export function formatNaira(amount: number): string {
    return nairaFormatter.format(amount);
}

/**
 * Format a date in long format (e.g., "January 2, 2026")
 */
export function formatDate(date: Date | string | number): string {
    const d = date instanceof Date ? date : new Date(date);
    return dateFormatter.format(d);
}

/**
 * Format a date with time (e.g., "January 2, 2026, 10:30 AM")
 */
export function formatDateTime(date: Date | string | number): string {
    const d = date instanceof Date ? date : new Date(date);
    return dateTimeFormatter.format(d);
}

/**
 * Format a date in short format (e.g., "Jan 2, 2026")
 */
export function formatShortDate(date: Date | string | number): string {
    const d = date instanceof Date ? date : new Date(date);
    return shortDateFormatter.format(d);
}

/**
 * Format a date as ISO string (e.g., "2026-01-02")
 */
export function formatIsoDate(date: Date | string | number): string {
    const d = date instanceof Date ? date : new Date(date);
    return isoDateFormatter.format(d);
}

/**
 * Format a number with thousands separator
 */
export function formatNumber(num: number, decimals = 0): string {
    return new Intl.NumberFormat('en-NG', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(num);
}

/**
 * Format a percentage
 */
export function formatPercent(value: number, decimals = 1): string {
    return new Intl.NumberFormat('en-NG', {
        style: 'percent',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(value);
}

/**
 * Format a phone number (Nigerian format)
 */
export function formatPhoneNumber(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');

    if (cleaned.startsWith('234') && cleaned.length === 13) {
        return `+${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)} ${cleaned.slice(9)}`;
    }

    if (cleaned.startsWith('0') && cleaned.length === 11) {
        return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
    }

    return phone;
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let unitIndex = 0;
    let size = bytes;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }

    return `${size.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

/**
 * Format a duration in milliseconds to human-readable format
 */
export function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}
