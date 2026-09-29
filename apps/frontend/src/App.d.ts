import "./App.css";
export type Evaluation = {
    evaluationId: number;
    scheduledDate: string;
    status: string;
    priority?: string;
    technicianId?: number;
    institution?: {
        name?: string;
    };
    technician?: {
        person?: {
            name?: string;
        };
    };
    report?: {
        status?: string | null;
    } | null;
    case?: {
        status?: string | null;
        caseId?: number;
        technicianId?: number | null;
    } | null;
    score?: {
        nivelRiesgo?: string | null;
    } | null;
};
declare function App(): import("react").JSX.Element;
export default App;
