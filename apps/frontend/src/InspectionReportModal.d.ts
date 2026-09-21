import './InspectionReportModal.css';
interface InspectionReportModalProps {
    evaluationId: number;
    role?: string;
    onClose: () => void;
    notify?: (msg: string) => void;
}
export default function InspectionReportModal({ evaluationId, role, onClose, notify, }: InspectionReportModalProps): import("react").JSX.Element;
export {};
