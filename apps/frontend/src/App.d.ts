import "./App.css";
export type Evaluation = {
    evaluationId: number;
    scheduledDate: string;
    status: string;
    priority?: string;
    institution?: {
        name?: string;
    };
};
declare function App(): import("react").JSX.Element;
export default App;
