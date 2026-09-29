import './DocumentCheck.css';
interface DocumentCheckProps {
    token: string;
    signedIn: boolean;
    onClose: () => void;
    onToken: (token: string) => void;
}
/** Pulls the seal out of a scanned QR, a verification link, or a pasted token. */
export declare function tokenFromScan(raw: string): string | null;
export default function DocumentCheck({ token, signedIn, onClose, onToken }: DocumentCheckProps): import("react").JSX.Element;
export {};
