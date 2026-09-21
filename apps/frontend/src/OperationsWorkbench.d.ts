import './OperationsWorkbench.css';
type Role = 'ADMIN' | 'ADMIN_EMPRESA' | 'USUARIO_DELEGADO' | 'COORDINADOR' | 'TECNICO_EVALUADOR';
type Tab = 'cases' | 'reports' | 'institutions' | 'bpm' | 'intake' | 'history';
export default function OperationsWorkbench({ role, initial, onOpenOfficialReport }: {
    role: Role;
    initial: Tab;
    onOpenOfficialReport?: (evaluationId: number) => void;
}): import("react").JSX.Element;
export {};
