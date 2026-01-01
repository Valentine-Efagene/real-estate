export class FormatHelper {
    public static nairaFormatter = new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
        minimumFractionDigits: 2,
    });

    public static formatNaira(amount: number): string {
        return this.nairaFormatter.format(amount);
    }

    public static formatDate(date: Date): string {
        return new Intl.DateTimeFormat('en-NG', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        }).format(date);
    }

    public static formatDateTime(date: Date): string {
        return new Intl.DateTimeFormat('en-NG', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).format(date);
    }
}
