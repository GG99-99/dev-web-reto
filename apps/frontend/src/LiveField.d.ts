import type { Evaluation } from './App';
import './App.css';
import './FieldAssessment.css';
type LiveFieldProps = {
    items?: Evaluation[];
    item?: Evaluation;
    live: boolean;
    inform: (message: string) => void;
    onViewReport?: (evaluationId: number) => void;
    onEvaluationUpdated?: (evaluationId: number, patch: Partial<Evaluation>) => void;
};
export interface StructuredQuestion {
    key: string;
    txt: string;
    h1Id: number;
    chapterName: string;
    sectionName: string;
    codeLabel: string;
    askType: 'h1' | 'h2' | 'h3' | 'h4';
    askId: number;
}
export interface ChapterGroup {
    h1Id: number;
    name: string;
    codePrefix: string;
    questions: StructuredQuestion[];
}
export default function LiveField({ items, item, live, inform, onViewReport, onEvaluationUpdated }: LiveFieldProps): import("react").JSX.Element;
export {};
