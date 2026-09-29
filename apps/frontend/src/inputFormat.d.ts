/**
 * Masks and checks for national ID, phone, RNC, and street number.
 * Dominican cédula is 11 digits: 000-0000000-0.
 */
type KeyGuardEvent = {
    key: string;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
    preventDefault: () => void;
    currentTarget: HTMLInputElement;
};
export declare function formatNationalId(raw: string): string;
export declare function isValidNationalId(value: string): boolean;
export declare function formatRnc(raw: string): string;
export declare function isValidRnc(value: string): boolean;
export declare function formatStreetNumber(raw: string): string;
export declare function isValidStreetNumber(value: string): boolean;
/** Local numbers become (809) 555-0101. A leading + keeps an international number. */
export declare function formatPhoneInput(raw: string): string;
export declare function isValidPhone(value: string): boolean;
export declare function isValidEmail(value: string): boolean;
export declare function isValidPersonName(value: string): boolean;
/** Blocks letters and extra digits. Dashes and parentheses are inserted by the mask. */
export declare function allowFormattedKey(event: KeyGuardEvent, options: {
    allowPlus?: boolean;
    maxDigits: number;
}): void;
export {};
