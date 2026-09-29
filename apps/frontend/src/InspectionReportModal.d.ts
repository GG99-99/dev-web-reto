import type { FormAnswers } from '@reto/shared';
import './InspectionReportModal.css';
interface InspectionReportModalProps {
    evaluationId: number;
    role?: string;
    answers?: FormAnswers;
    onClose: () => void;
    notify?: (msg: string) => void;
}
export default function InspectionReportModal({ evaluationId, role, answers, onClose, notify, }: InspectionReportModalProps): import("react").JSX.Element;
export {};
