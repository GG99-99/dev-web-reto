import './TechnicianCalendar.css';
interface TechnicianCalendarProps {
    role?: string;
    onOpenField?: (evaluationId: number) => void;
    notify?: (message: string) => void;
}
export default function TechnicianCalendar({ role, onOpenField, notify }: TechnicianCalendarProps): import("react").JSX.Element;
export {};
