/** English label for a stored status, priority, or record-type code. */
export declare function statusLabel(value?: string | null): string;
/** Status the company should see for one BPM request, preferring the server snapshot. */
export declare function requestLifecycle(request?: {
    status?: string | null;
    lifecycleStatus?: string | null;
    case?: {
        status?: string | null;
        technicianId?: number | null;
        evaluations?: Array<{
            status?: string | null;
            createdAt?: string | null;
            report?: {
                status?: string | null;
            } | null;
        }> | null;
    } | null;
} | null): string;
/** Status the company should see for one evaluation, including its report and case. */
export declare function evaluationLifecycle(evaluation?: {
    status?: string | null;
    technicianId?: number | null;
    report?: {
        status?: string | null;
    } | null;
    case?: {
        status?: string | null;
        technicianId?: number | null;
    } | null;
} | null): string;
/** 1 draft, 2 submitted, 3 assigned, 4 fieldwork or review, 5 decision. */
export declare function lifecycleStage(status?: string | null): number;
export declare function isOpenLifecycle(status?: string | null): boolean;
export declare function isDoneLifecycle(status?: string | null): boolean;
