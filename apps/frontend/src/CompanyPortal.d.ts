import './CompanyPortal.css';
type Role = 'ADMIN' | 'ADMIN_EMPRESA' | 'USUARIO_DELEGADO' | 'COORDINADOR' | 'TECNICO_EVALUADOR';
interface CompanyPortalProps {
    role: Role;
    notify: (msg: string) => void;
    onOpenOfficialReport?: (evaluationId: number) => void;
}
export default function CompanyPortal({ role, notify, onOpenOfficialReport }: CompanyPortalProps): import("react").JSX.Element;
export {};
