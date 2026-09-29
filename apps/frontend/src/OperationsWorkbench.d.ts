import './OperationsWorkbench.css';
type Role = 'ADMIN' | 'ADMIN_EMPRESA' | 'USUARIO_DELEGADO' | 'COORDINADOR' | 'TECNICO_EVALUADOR';
type Tab = 'cases' | 'reports' | 'bpm' | 'intake' | 'history';
export default function OperationsWorkbench({ role, initial, onOpenOfficialReport, onOpenField }: {
    role: Role;
    initial: Tab;
    onOpenOfficialReport?: (evaluationId: number) => void;
    onOpenField?: (evaluationId: number) => void;
}): import("react").JSX.Element;
export {};
