import './TechnicianCalendar.css';
interface TechnicianCalendarProps {
    onOpenField?: (evaluationId: number) => void;
    notify?: (message: string) => void;
}
export default function TechnicianCalendar({ onOpenField, notify }: TechnicianCalendarProps): import("react").JSX.Element;
export {};
