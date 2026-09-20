import './OperationsWorkbench.css';
type Role = 'ADMIN' | 'ADMIN_EMPRESA' | 'USUARIO_DELEGADO' | 'COORDINADOR' | 'TECNICO_EVALUADOR';
type Tab = 'cases' | 'reports' | 'institutions' | 'bpm' | 'intake' | 'history';
export default function OperationsWorkbench({ role, initial }: {
    role: Role;
    initial: Tab;
}): import("react").JSX.Element;
export {};
