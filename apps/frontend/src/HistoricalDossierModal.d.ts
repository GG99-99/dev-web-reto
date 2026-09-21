import './HistoricalDossierModal.css';
interface HistoricalDossierModalProps {
    entityType: 'CASE' | 'EVALUATION' | 'BPM_REQUEST' | 'INSTITUTION';
    entityId: number;
    onClose: () => void;
    onOpenOfficialReport?: (evaluationId: number) => void;
    notify?: (msg: string) => void;
}
export default function HistoricalDossierModal({ entityType, entityId, onClose, onOpenOfficialReport, notify, }: HistoricalDossierModalProps): import("react").JSX.Element;
export {};
