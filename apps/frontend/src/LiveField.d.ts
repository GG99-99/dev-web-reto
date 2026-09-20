import type { Evaluation } from './App';
import './App.css';
type LiveFieldProps = {
    item?: Evaluation;
    live: boolean;
    inform: (message: string) => void;
};
export default function LiveField({ item, live, inform }: LiveFieldProps): import("react").JSX.Element;
export {};
