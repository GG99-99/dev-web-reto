// @ts-nocheck
// The dashboard endpoints deliberately return different role-specific payloads.
// Runtime guards below normalize them for the shared presentation layer.
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  authService,
  casesService,
  dashboardService,
  evaluationsService,
  formExecutionService,
  usersService,
} from "./services";
import LiveField from "./LiveField";
import OperationsWorkbench from "./OperationsWorkbench";
import UserApprovalPanel from "./UserApprovalPanel";
import TechnicianCalendar from "./TechnicianCalendar";
import InspectionReportModal from "./InspectionReportModal";
import CompanyPortal from "./CompanyPortal";
import NotificationsDropdown from "./NotificationsDropdown";
import AdminGovernancePanel from "./AdminGovernancePanel";
import {
  getAssignedEvaluations,
  getPendingSyncQueue,
  removeSyncQueueItem,
  saveAssignedEvaluations,
} from "./services/offlineStorage";
import {
  setAccessTokenProvider,
  setOnSessionExpired,
  setOnTokenRefreshed,
  setRefreshTokenProvider,
} from "./services/httpClient";
import "./App.css";
import { deriveLifecycleStatus } from "@reto/shared";
import { statusLabel } from "./statusLabels";
import {
  allowFormattedKey,
  formatNationalId,
  formatPhoneInput,
  isValidEmail,
  isValidNationalId,
  isValidPersonName,
  isValidPhone,
} from "./inputFormat";

type Role =
  | "ADMIN"
  | "ADMIN_EMPRESA"
  | "USUARIO_DELEGADO"
  | "COORDINADOR"
  | "TECNICO_EVALUADOR";
type View =
  | "overview"
  | "calendar"
  | "field"
  | "users"
  | "cases"
  | "reports"
  | "operations"
  | "company"
  | "governance";
type AuthMode = "signin" | "signup" | "forgot" | "twoFactor";
type Session = {
  accessToken: string;
  refreshToken: string;
  name: string;
  role: Role;
};
type CaseItem = {
  caseId: number;
  origin: string;
  status: string;
  priority: string;
  institution?: { name?: string };
  technician?: { person?: { name?: string } };
  openedAt?: string;
};
type CompanyRequestCard = {
  id: number;
  name: string;
  status: string;
};
export type Evaluation = {
  evaluationId: number;
  scheduledDate: string;
  status: string;
  priority?: string;
  technicianId?: number;
  institution?: { name?: string };
  technician?: { person?: { name?: string } };
  report?: { status?: string | null } | null;
  case?: { status?: string | null; caseId?: number; technicianId?: number | null } | null;
  score?: { nivelRiesgo?: string | null } | null;
};

function evaluationLifecycle(item: Evaluation) {
  return deriveLifecycleStatus({
    caseStatus: item.case?.status,
    technicianId: item.technicianId ?? item.case?.technicianId,
    evaluationStatus: item.status,
    reportStatus: item.report?.status,
  });
}

const sessionKey = "radar-session";
const nav: { id: View; label: string; icon: string }[] = [
  { id: "overview", label: "Command center", icon: "▦" },
  { id: "company", label: "Company portal", icon: "🏢" },
  { id: "calendar", label: "Calendar agenda", icon: "📅" },
  { id: "field", label: "Field assessment", icon: "✓" },
  { id: "users", label: "User validation", icon: "👥" },
  { id: "cases", label: "Cases & assignments", icon: "⌘" },
  { id: "reports", label: "Reports & closure", icon: "▤" },
  { id: "operations", label: "Operational workflows", icon: "◫" },
  { id: "governance", label: "Governance & Rules", icon: "⚙" },
];
const navForRole = (role: Role) =>
  nav.filter((item) => {
    if (item.id === "users") return role === "ADMIN";
    if (item.id === "governance") return role === "ADMIN";
    if (item.id === "calendar")
      return (
        role === "TECNICO_EVALUADOR" ||
        role === "COORDINADOR" ||
        role === "ADMIN"
      );
    if (item.id === "cases") return role === "ADMIN" || role === "COORDINADOR";
    if (item.id === "field") return role === "TECNICO_EVALUADOR";
    if (item.id === "reports")
      return (
        role === "ADMIN" ||
        role === "COORDINADOR" ||
        role === "TECNICO_EVALUADOR"
      );
    // Company roles have their own dedicated CompanyPortal — they don't need OperationsWorkbench
    if (item.id === "operations")
      return role !== "TECNICO_EVALUADOR" && role !== "ADMIN_EMPRESA" && role !== "USUARIO_DELEGADO";
    if (item.id === "company")
      return (
        role === "ADMIN_EMPRESA" ||
        role === "USUARIO_DELEGADO" ||
        role === "ADMIN" ||
        role === "COORDINADOR"
      );
    return true;
  });
const title = (value: string) =>
  value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
const date = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        hour: value.includes("T") ? "numeric" : undefined,
        minute: value.includes("T") ? "2-digit" : undefined,
      }).format(new Date(value))
    : "Not scheduled";

function App() {
  const [session, setSession] = useState<Session | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(sessionKey) ?? "null");
    } catch {
      return null;
    }
  });
  const [view, setView] = useState<View>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(sessionKey) ?? "null");
      if (
        parsed?.role === "ADMIN_EMPRESA" ||
        parsed?.role === "USUARIO_DELEGADO"
      )
        return "company";
      return "overview";
    } catch {
      return "overview";
    }
  });
  const [menu, setMenu] = useState(false);
  const [login, setLogin] = useState(false);
  const [notice, setNotice] = useState("");
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [companyRequests, setCompanyRequests] = useState<CompanyRequestCard[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [metrics, setMetrics] = useState({
    pending: 0,
    alerts: 0,
    complaints: 0,
  });
  const [loading, setLoading] = useState(false);
  const [activeEvaluationId, setActiveEvaluationId] = useState<number | null>(
    null,
  );
  const [activeReport, setActiveReport] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  const refreshPendingSyncCount = async () => {
    const queue = await getPendingSyncQueue();
    setPendingSyncCount(queue.length);
  };

  const syncPendingChanges = async () => {
    if (!navigator.onLine) {
      setNotice(
        "Reconnect to the internet before synchronising local changes.",
      );
      return;
    }
    try {
      const queue = await getPendingSyncQueue();
      if (!queue.length) {
        setNotice("There are no pending local changes to synchronise.");
        return;
      }
      let synced = 0;
      for (const item of queue) {
        const result = await formExecutionService.saveAnswers(
          item.evaluationId,
          { answers: item.answers },
        );
        if (result.valid) {
          await removeSyncQueueItem(item.evaluationId);
          synced += 1;
        }
      }
      await refreshPendingSyncCount();
      setNotice(
        synced
          ? `${synced} offline ${synced === 1 ? "assessment was" : "assessments were"} synchronised.`
          : "No pending changes could be synchronised. They remain safely on this device.",
      );
    } catch {
      await refreshPendingSyncCount();
      setNotice(
        "Synchronisation could not finish. Your local changes remain on this device.",
      );
    }
  };

  // Listen to connectivity & local sync queue
  useEffect(() => {
    const checkSync = async () => {
      try {
        await refreshPendingSyncCount();
      } catch {
        // Ignore transient offline-storage errors silently
      }
    };

    const handleOnline = () => {
      setIsOnline(true);
      void checkSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    void checkSync();
    // Poll every 30 seconds instead of 5 to reduce noise
    const timer = setInterval(() => void checkSync(), 30_000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(timer);
    };
  }, []);

  const saveSession = (value: Session | null) => {
    setSession(value);
    if (value) localStorage.setItem(sessionKey, JSON.stringify(value));
    else localStorage.removeItem(sessionKey);
  };
  const signOut = async () => {
    const refreshToken = session?.refreshToken;
    try {
      if (refreshToken) await authService.logout({ refreshToken });
    } finally {
      saveSession(null);
      setView("overview");
      setCases([]);
      setCompanyRequests([]);
      setEvaluations([]);
      setMetrics({ pending: 0, alerts: 0, complaints: 0 });
      setNotice("You have been signed out.");
    }
  };
  useEffect(() => {
    setAccessTokenProvider(() => session?.accessToken);
    setRefreshTokenProvider(() => session?.refreshToken);
    setOnTokenRefreshed((accessToken, refreshToken) => {
      if (session) saveSession({ ...session, accessToken, refreshToken });
    });
    setOnSessionExpired(() => {
      saveSession(null);
      setView("overview");
      setCases([]);
      setCompanyRequests([]);
      setEvaluations([]);
      setMetrics({ pending: 0, alerts: 0, complaints: 0 });
      setNotice("Your session expired. Please sign in again.");
    });
  }, [session]);
  useEffect(() => {
    if (!session) return;
    const activeSession = session;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const dashboardPromise =
          activeSession.role === "TECNICO_EVALUADOR"
            ? dashboardService.getTecnicoDashboard()
            : ["COORDINADOR", "ADMIN"].includes(activeSession.role)
              ? dashboardService.getCoordinadorDashboard()
              : dashboardService.getEmpresaDashboard();
        const [caseResponse, evaluationResponse, dashboardResponse] =
          await Promise.all([
            ["COORDINADOR", "ADMIN"].includes(activeSession.role)
              ? casesService.list()
              : Promise.resolve(null),
            ["COORDINADOR", "TECNICO_EVALUADOR", "ADMIN"].includes(
              activeSession.role,
            )
              ? evaluationsService.list()
              : Promise.resolve(null),
            dashboardPromise,
          ]);
        if (cancelled) return;
        if (caseResponse?.valid)
          setCases(caseResponse.data.items as unknown as CaseItem[]);
        if (evaluationResponse?.valid) {
          const items = evaluationResponse.data.items as unknown as Evaluation[];
          setEvaluations(items);
          saveAssignedEvaluations(items);
        }
        if (dashboardResponse.valid) {
          const data = dashboardResponse.data as unknown as Record<
            string,
            unknown
          >;
          const dashboardEvaluations =
            data.evaluacionesProgramadas ??
            data.evaluacionesAsignadas ??
            data.evaluaciones;
          if (!evaluationResponse?.valid && Array.isArray(dashboardEvaluations))
            setEvaluations(dashboardEvaluations as Evaluation[]);
          const companyRequests = Array.isArray(data.misSolicitudes)
            ? (data.misSolicitudes as Array<Record<string, unknown>>)
            : [];
          if (
            activeSession.role === "ADMIN_EMPRESA" ||
            activeSession.role === "USUARIO_DELEGADO"
          ) {
            setCompanyRequests(
              companyRequests.flatMap((request) => {
                const id = Number(request.bpmRequestId);
                if (!Number.isFinite(id)) return [];
                const institution = request.institution as { name?: string } | null | undefined;
                return [{
                  id,
                  name: institution?.name ?? `Request #${id}`,
                  status: String(request.lifecycleStatus ?? request.status ?? "PENDIENTE_ASIGNACION"),
                }];
              }),
            );
            const companyCases = companyRequests.flatMap((request) => {
              const linked = request.case as CaseItem & { caseId?: number } | null | undefined;
              if (!linked?.caseId) return [];
              return [{
                ...linked,
                caseId: linked.caseId,
                institution: (request.institution as CaseItem["institution"]) ?? linked.institution,
                origin: linked.origin ?? "SOLICITUD_EMPRESA",
                status: linked.status,
                priority: linked.priority ?? "MEDIA",
              }];
            });
            setCases(companyCases);
          } else {
            setCompanyRequests([]);
          }
          const awaitingDecision = companyRequests.filter((request) => {
            const status = String(request.lifecycleStatus ?? request.status ?? "");
            return status === "EN_REVISION" || status === "FINALIZADA" || status === "EN_CORRECCION";
          }).length;
          setMetrics({
            pending: Number(
              data.casosPendientes ??
                (companyRequests.length || 0),
            ),
            alerts: Array.isArray(data.alertasLapchAbiertas)
              ? data.alertasLapchAbiertas.length
              : Number(data.notificacionesNoLeidas ?? 0),
            complaints: Array.isArray(data.denunciasAbiertas)
              ? data.denunciasAbiertas.length
              : Array.isArray(data.pendientesDeInforme)
                ? data.pendientesDeInforme.length
                : awaitingDecision,
          });
        }
      } catch {
        if (!cancelled) {
          if (typeof navigator !== "undefined" && navigator.onLine === false) {
            const cached = getAssignedEvaluations<Evaluation>();
            if (cached.length) setEvaluations(cached);
          }
          setNotice(
            "Some dashboard data could not be loaded. Check that the backend is running.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [session, view]);
  const visibleCases = cases;
  const visibleEvaluations = evaluations;
  if (!session)
    return (
      <AuthPortal
        initialMessage={notice}
        onSignedIn={(value) => {
          saveSession(value);
          setNotice("");
          setView(
            value.role === "ADMIN_EMPRESA" || value.role === "USUARIO_DELEGADO"
              ? "company"
              : "overview",
          );
        }}
      />
    );
  const visibleNav = navForRole(session.role);
  return (
    <div className="app-shell">
      <aside className={`sidebar ${menu ? "sidebar--open" : ""}`}>
        <div className="brand">
          <b>R</b> RADAR<span>Sanitary</span>
        </div>
        <small className="side-label">Operational workspace</small>
        <nav>
          {visibleNav.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? "active" : ""}
              onClick={() => {
                setView(item.id);
                setMenu(false);
              }}
            >
              <i>{item.icon}</i>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="side-bottom">
          <p>
            <em style={{ background: isOnline ? "#22c55e" : "#f59e0b" }} />{" "}
            <strong>{isOnline ? "Connected" : "Offline Mode"}</strong>
            <small>
              {isOnline ? "Live workspace" : "Local storage active"}
            </small>
          </p>
          {pendingSyncCount > 0 && (
            <div
              style={{
                margin: "6px 0",
                fontSize: "0.75rem",
                color: "#f59e0b",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>⏳ {pendingSyncCount} pending</span>
              {isOnline && (
                <button
                  type="button"
                  style={{
                    background: "none",
                    border: "none",
                    color: "#60a5fa",
                    cursor: "pointer",
                    fontSize: "0.72rem",
                    textDecoration: "underline",
                    padding: 0,
                  }}
                  onClick={() => void syncPendingChanges()}
                >
                  Synchronise
                </button>
              )}
            </div>
          )}
        </div>
      </aside>
      <main>
        <header>
          <button
            type="button"
            className="hamburger"
            title="Open navigation"
            aria-label="Open navigation"
            onClick={() => setMenu(!menu)}
          >
            ☰
          </button>
          <div className="crumb">
            Operations <span>/</span>{" "}
            <strong>
              {visibleNav.find((item) => item.id === view)?.label ??
                "Command center"}
            </strong>
          </div>
          <div className="header-actions" style={{ position: "relative" }}>
            <button
              type="button"
              className="notification"
              title="Notifications"
              aria-label="Notifications"
              onClick={() => setShowNotifications((prev) => !prev)}
            >
              🔔
              {unreadNotifCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: "-4px",
                    right: "-4px",
                    background: "#ef4444",
                    color: "#ffffff",
                    fontSize: "0.65rem",
                    fontWeight: 800,
                    borderRadius: "999px",
                    padding: "1px 5px",
                    lineHeight: "1",
                    border: "2px solid #ffffff",
                  }}
                >
                  {unreadNotifCount}
                </span>
              )}
            </button>
            <NotificationsDropdown
              isOpen={showNotifications}
              onClose={() => setShowNotifications(false)}
              onUpdateUnreadCount={setUnreadNotifCount}
              notify={setNotice}
            />
            <div style={{ position: "relative" }}>
              <button
                type="button"
                className="profile"
                title="Account menu"
                aria-label="Account menu"
                onClick={() => setShowProfileMenu((prev) => !prev)}
                aria-haspopup="true"
                aria-expanded={showProfileMenu}
              >
                <b>{session.name.slice(0, 2).toUpperCase()}</b>
                <span>
                  <strong>{session.name}</strong>
                  <small>{title(session.role)}</small>
                </span>
                <small style={{ marginLeft: 4, color: "#94a3b8", fontSize: 10 }}>▾</small>
              </button>
              {showProfileMenu && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    right: 0,
                    minWidth: 180,
                    background: "#fff",
                    border: "1px solid #dce5ef",
                    borderRadius: 8,
                    boxShadow: "0 8px 24px #0819381a",
                    zIndex: 100,
                    overflow: "hidden",
                  }}
                >
                  <div style={{ padding: "10px 14px", borderBottom: "1px solid #edf1f5" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#14243b" }}>{session.name}</div>
                    <div style={{ fontSize: 11, color: "#718096", marginTop: 2 }}>{title(session.role)}</div>
                  </div>
                  <button
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      border: "none",
                      background: "transparent",
                      color: "#d94b4b",
                      fontSize: 13,
                      fontWeight: 700,
                      textAlign: "left",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#fff5f5"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                    onClick={() => {
                      setShowProfileMenu(false);
                      void signOut();
                    }}
                  >
                    ⎋ Sign out
                  </button>
                </div>
              )}
              {showProfileMenu && (
                <div
                  style={{ position: "fixed", inset: 0, zIndex: 99 }}
                  onClick={() => setShowProfileMenu(false)}
                />
              )}
            </div>
          </div>
        </header>
        {notice && (
          <div className="notice" role="status">
            ⓘ {notice}
            <button onClick={() => setNotice("")}>×</button>
          </div>
        )}
        <div className="workspace">
          {view === "overview" && (
            <Overview
              items={visibleEvaluations}
              cases={visibleCases}
              requests={companyRequests}
              metrics={metrics}
              loading={loading}
              role={session.role}
              name={session.name}
              go={setView}
            />
          )}
          {view === "company" && (
            <CompanyPortal
              role={session.role}
              notify={setNotice}
              onOpenOfficialReport={(id) => setActiveReport({ evaluationId: id })}
            />
          )}
          {view === "calendar" && (
            <TechnicianCalendar
              role={session.role}
              onOpenField={
                session.role === "TECNICO_EVALUADOR"
                  ? (id) => {
                      setActiveEvaluationId(id);
                      setView("field");
                    }
                  : undefined
              }
              notify={setNotice}
            />
          )}
          {view === "users" && <UserApprovalPanel notify={setNotice} />}
          {view === "cases" && (
            <OperationsWorkbench
              role={session.role}
              initial="cases"
              onOpenOfficialReport={(id) => setActiveReport({ evaluationId: id })}
            />
          )}
          {view === "field" && session.role === "TECNICO_EVALUADOR" && (
            <LiveField
              items={visibleEvaluations}
              item={
                visibleEvaluations.find(
                  (e) => e.evaluationId === activeEvaluationId,
                ) ?? visibleEvaluations[0]
              }
              live
              inform={setNotice}
              onViewReport={(id, answers) => setActiveReport({ evaluationId: id, answers })}
              onEvaluationUpdated={(evaluationId, patch) => {
                setEvaluations((current) => {
                  const next = current.map((entry) =>
                    entry.evaluationId === evaluationId
                      ? { ...entry, ...patch }
                      : entry,
                  );
                  saveAssignedEvaluations(next);
                  return next;
                });
              }}
            />
          )}
          {view === "reports" && (
            <OperationsWorkbench
              role={session.role}
              initial="reports"
              onOpenOfficialReport={(id) => setActiveReport({ evaluationId: id })}
              onOpenField={
                session.role === "TECNICO_EVALUADOR"
                  ? (id) => {
                      setActiveEvaluationId(id);
                      setView("field");
                    }
                  : undefined
              }
            />
          )}
          {view === "operations" && (
            <OperationsWorkbench
              role={session.role}
              initial="cases"
              onOpenOfficialReport={(id) => setActiveReport({ evaluationId: id })}
            />
          )}
          {view === "governance" && <AdminGovernancePanel notify={setNotice} />}
        </div>
        {activeReport !== null && (
          <InspectionReportModal
            evaluationId={activeReport.evaluationId}
            answers={activeReport.answers}
            role={session.role}
            onClose={() => setActiveReport(null)}
            notify={setNotice}
          />
        )}{" "}
        {login && (
          <Login
            close={() => setLogin(false)}
            success={(value) => {
              saveSession(value);
              setLogin(false);
              setNotice(
                `Welcome back, ${value.name}. Your workspace is ready.`,
              );
            }}
          />
        )}
      </main>
    </div>
  );
}

function errorMessage(error: unknown, fallback: string) {
  const message =
    (
      error as { response?: { data?: { error?: { message?: string } } } }
    )?.response?.data?.error?.message?.toLowerCase() ?? "";
  if (message.includes("pending"))
    return "Your registration is pending approval. We will notify you when access is available.";
  if (message.includes("rejected"))
    return "Your registration was not approved. Please contact your organisation administrator.";
  if (message.includes("incorrect"))
    return "The email or ID and password do not match our records.";
  return fallback;
}

function AuthPortal({
  initialMessage,
  onSignedIn,
}: {
  initialMessage: string;
  onSignedIn: (value: Session) => void;
}) {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [tempToken, setTempToken] = useState("");
  const [notice, setNotice] = useState(initialMessage);
  const [busy, setBusy] = useState(false);
  const emptySignup = {
    name: "",
    email: "",
    cedula: "",
    phone: "",
    password: "",
    confirmPassword: "",
    roleId: "2",
  };
  const [signup, setSignup] = useState(emptySignup);
  const [signupFormKey, setSignupFormKey] = useState(0);
  const [authLetter, setAuthLetter] = useState<File | null>(null);
  const setSignupField = (key: keyof typeof signup, value: string) =>
    setSignup((current) => ({ ...current, [key]: value }));
  const switchMode = (next: AuthMode) => {
    setMode(next);
    setNotice("");
    setBusy(false);
    setAuthLetter(null);
  };
  const completeLogin = (result: {
    accessToken: string;
    refreshToken: string;
    user?: unknown;
  }) => {
    const user = result.user as
      | { person?: { name?: string }; role?: { name?: Role } }
      | undefined;
    onSignedIn({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      name: user?.person?.name ?? usuario,
      role: user?.role?.name ?? "COORDINADOR",
    });
  };
  async function submitSignIn(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const result = await authService.login({ usuario, password });
      if (!result.valid) {
        setNotice(
          "We could not sign you in. Please check your details and try again.",
        );
        return;
      }
      if (result.data.requiresTwoFactor && result.data.tempToken) {
        setTempToken(result.data.tempToken);
        switchMode("twoFactor");
        return;
      }
      completeLogin(result.data);
    } catch (error) {
      setNotice(
        errorMessage(
          error,
          "We could not sign you in. Check your connection and try again.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  async function submitTwoFactor(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const result = await authService.verify2FA({ tempToken, code });
      if (!result.valid) {
        setNotice("That verification code was not accepted. Please try again.");
        return;
      }
      completeLogin(result.data);
    } catch {
      setNotice("That verification code was not accepted. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function submitSignUp(event: FormEvent) {
    event.preventDefault();
    setNotice("");
    if (!isValidPersonName(signup.name)) {
      setNotice("Enter your full name.");
      return;
    }
    if (!isValidEmail(signup.email)) {
      setNotice("Enter a valid work email address.");
      return;
    }
    if (!isValidNationalId(signup.cedula)) {
      setNotice("National ID must use the format 000-0000000-0.");
      return;
    }
    if (!isValidPhone(signup.phone)) {
      setNotice("Enter a valid phone number, such as (809) 555-0101 or +44 20 7946 0958.");
      return;
    }
    if (signup.password.length < 8) {
      setNotice("Use a password with at least 8 characters.");
      return;
    }
    if (signup.password !== signup.confirmPassword) {
      setNotice("Your passwords do not match.");
      return;
    }
    if (!authLetter) {
      setNotice("Upload the authorization letter for your organisation.");
      return;
    }
    setBusy(true);
    try {
      const uploaded = await usersService.uploadAuthorizationLetter(authLetter);
      if (!uploaded.valid) {
        setNotice("We could not upload the authorization letter. Please try again.");
        return;
      }
      const result = await usersService.register({
        person: {
          name: signup.name,
          email: signup.email,
          cedula: signup.cedula,
          phone: signup.phone,
        },
        password: signup.password,
        roleId: Number(signup.roleId),
        cartaAutorizacionFileId: uploaded.data.attachmentId,
      });
      if (!result.valid) {
        setNotice(
          "We could not submit your registration. Please review the form and try again.",
        );
        return;
      }
      setUsuario(signup.email);
      setPassword("");
      setSignup(emptySignup);
      setAuthLetter(null);
      setSignupFormKey((key) => key + 1);
      setNotice(
        "Registration received. An administrator must approve your account before you can sign in.",
      );
      setMode("signin");
    } catch (error) {
      setNotice(
        errorMessage(
          error,
          "We could not submit your registration. Check your details and try again.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  async function submitRecovery(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      await authService.forgotPassword({ email: usuario });
      setNotice(
        "If this address belongs to an account, recovery instructions have been sent.",
      );
      setMode("signin");
    } catch {
      setNotice(
        "We could not start password recovery. Please try again later.",
      );
    } finally {
      setBusy(false);
    }
  }
  const heading =
    mode === "signup"
      ? "Create your organisation account"
      : mode === "forgot"
        ? "Reset your password"
        : mode === "twoFactor"
          ? "Confirm it is you"
          : "Sign in to your workspace";
  const subheading =
    mode === "signup"
      ? "Submit an access request for review. You will be notified when your account is approved."
      : mode === "forgot"
        ? "Enter your work email and we will send recovery instructions."
        : mode === "twoFactor"
          ? "Enter the six-digit code from your authenticator app."
          : "Use your approved email address or national ID to continue.";
  return (
    <main className="auth-page">
      <header className="auth-header">
        <a className="auth-brand" href="/" aria-label="RADAR home">
          <b>R</b>
          <span>
            RADAR <em>Sanitary</em>
          </span>
        </a>
        <a className="auth-help" href="mailto:support@radar.local">
          Need help?
        </a>
      </header>
      <section className="auth-layout">
        <aside className="auth-hero">
          <small className="eyebrow">Food safety operations</small>
          <h1>
            Confidence in every <em>inspection.</em>
          </h1>
          <p>
            RADAR connects sanitary teams, organisations, and field assessors
            through one protected workflow.
          </p>
          <div className="auth-benefits">
            <p>
              <b>01</b>
              <span>
                <strong>Clear accountability</strong>
                <small>
                  Role-based workspaces keep each decision traceable.
                </small>
              </span>
            </p>
            <p>
              <b>02</b>
              <span>
                <strong>Evidence, in context</strong>
                <small>
                  Capture findings and supporting files where the work happens.
                </small>
              </span>
            </p>
            <p>
              <b>03</b>
              <span>
                <strong>Safer closures</strong>
                <small>
                  Move from intake to decision with a complete record.
                </small>
              </span>
            </p>
          </div>
          <footer>
            Protected access · Audit-ready records · Built for field work
          </footer>
        </aside>
        <section className="auth-card" aria-live="polite">
          <div className="auth-step">
            <span>{mode === "signup" ? "New account" : "Secure access"}</span>
            <i>{mode === "signup" ? "2 of 2" : "RADAR"}</i>
          </div>
          <h2>{heading}</h2>
          <p>{subheading}</p>
          {notice && (
            <div className="auth-notice" role="status">
              {notice}
            </div>
          )}
          {mode === "signin" && (
            <form onSubmit={submitSignIn}>
              <label>
                Work email or national ID
                <input
                  autoFocus
                  value={usuario}
                  onChange={(event) => setUsuario(event.target.value)}
                  required
                  autoComplete="username"
                  placeholder="name@organisation.gov"
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                />
              </label>
              <button className="primary" disabled={busy}>
                {busy ? "Signing in…" : "Sign in to RADAR"} <span>→</span>
              </button>
              <button
                type="button"
                className="text auth-link"
                onClick={() => switchMode("forgot")}
              >
                Forgot your password?
              </button>
              <div className="auth-divider">
                <span>New to RADAR?</span>
              </div>
              <button
                type="button"
                className="secondary auth-full"
                onClick={() => switchMode("signup")}
              >
                Create an organisation account
              </button>
            </form>
          )}
          {mode === "twoFactor" && (
            <form onSubmit={submitTwoFactor}>
              <label>
                Verification code
                <input
                  autoFocus
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                />
              </label>
              <button className="primary" disabled={busy}>
                {busy ? "Verifying…" : "Verify and continue"} <span>→</span>
              </button>
              <button
                type="button"
                className="text auth-link"
                onClick={() => switchMode("signin")}
              >
                Use a different account
              </button>
            </form>
          )}
          {mode === "forgot" && (
            <form onSubmit={submitRecovery}>
              <label>
                Work email
                <input
                  autoFocus
                  type="email"
                  value={usuario}
                  onChange={(event) => setUsuario(event.target.value)}
                  required
                  autoComplete="email"
                  placeholder="name@organisation.gov"
                />
              </label>
              <button className="primary" disabled={busy}>
                {busy ? "Sending…" : "Send recovery instructions"}{" "}
                <span>→</span>
              </button>
              <button
                type="button"
                className="text auth-link"
                onClick={() => switchMode("signin")}
              >
                ← Back to sign in
              </button>
            </form>
          )}
          {mode === "signup" && (
            <form key={signupFormKey} onSubmit={submitSignUp} autoComplete="off">
              <div className="auth-form-grid">
                <label>
                  Full name
                  <input
                    autoFocus
                    value={signup.name}
                    onChange={(event) =>
                      setSignupField("name", event.target.value)
                    }
                    required
                    autoComplete="off"
                    placeholder="Your full name"
                  />
                </label>
                <label>
                  Work email
                  <input
                    type="email"
                    value={signup.email}
                    onChange={(event) =>
                      setSignupField("email", event.target.value)
                    }
                    required
                    autoComplete="off"
                    placeholder="name@organisation.com"
                  />
                </label>
                <label>
                  National ID
                  <input
                    value={signup.cedula}
                    onKeyDown={(event) => allowFormattedKey(event, { maxDigits: 11 })}
                    onChange={(event) =>
                      setSignupField("cedula", formatNationalId(event.target.value))
                    }
                    required
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="000-0000000-0"
                    aria-describedby="signup-cedula-hint"
                  />
                </label>
                <label>
                  Phone number
                  <input
                    type="tel"
                    value={signup.phone}
                    onKeyDown={(event) =>
                      allowFormattedKey(event, {
                        allowPlus: true,
                        maxDigits: event.currentTarget.value.includes("+") ? 15 : 10,
                      })
                    }
                    onChange={(event) =>
                      setSignupField("phone", formatPhoneInput(event.target.value))
                    }
                    required
                    inputMode="tel"
                    autoComplete="off"
                    placeholder="(809) 555-0101"
                  />
                </label>
              </div>
              <p id="signup-cedula-hint" className="auth-fineprint" style={{ marginTop: 0 }}>
                National ID uses 000-0000000-0. Phone accepts a local number or an international number starting with +.
              </p>
              <label>
                Account type
                <select
                  value={signup.roleId}
                  onChange={(event) =>
                    setSignupField("roleId", event.target.value)
                  }
                >
                  <option value="2">Organisation administrator</option>
                  <option value="3">Authorised delegate</option>
                </select>
              </label>
              <label>
                Create password
                <input
                  type="password"
                  value={signup.password}
                  onChange={(event) =>
                    setSignupField("password", event.target.value)
                  }
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                />
              </label>
              <label>
                Confirm password
                <input
                  type="password"
                  value={signup.confirmPassword}
                  onChange={(event) =>
                    setSignupField("confirmPassword", event.target.value)
                  }
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                />
              </label>
              <label>
                Authorization letter
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.txt"
                  onChange={(event) =>
                    setAuthLetter(event.target.files?.[0] ?? null)
                  }
                />
              </label>
              <button className="primary" disabled={busy}>
                {busy ? "Submitting…" : "Submit access request"} <span>→</span>
              </button>
              <p className="auth-fineprint">
                Operational coordinators and field assessors receive accounts
                through their system administrator.
              </p>
              <button
                type="button"
                className="text auth-link"
                onClick={() => switchMode("signin")}
              >
                Already have an account? Sign in
              </button>
            </form>
          )}
        </section>
      </section>
    </main>
  );
}

function companyAttentionRank(status: string) {
  if (status === "EN_CORRECCION" || status === "DEVUELTO") return 0;
  if (status === "BORRADOR") return 1;
  if (status === "RECHAZADA" || status === "RECHAZADO") return 2;
  if (status === "APROBADA" || status === "APROBADO" || status === "CERRADO") return 3;
  return 4;
}

function companyAttentionDetail(status: string) {
  switch (status) {
    case "BORRADOR":
      return "Draft — submit it from the company portal";
    case "EN_CORRECCION":
    case "DEVUELTO":
      return "Returned for correction — review it in the company portal";
    case "PENDIENTE_ASIGNACION":
      return "Submitted — waiting for an evaluator";
    case "ASIGNADO":
      return "An evaluator has been assigned";
    case "EN_PROCESO":
      return "Field assessment is underway";
    case "FINALIZADA":
    case "ENVIADO":
    case "EN_REVISION":
      return "Under review by the health authority";
    case "APROBADA":
    case "APROBADO":
    case "CERRADO":
      return "Decision available in the company portal";
    case "RECHAZADA":
    case "RECHAZADO":
      return "This request was not approved";
    default:
      return statusLabel(status);
  }
}

function Overview({
  items,
  cases,
  requests,
  metrics,
  loading,
  role,
  name,
  go,
}: {
  items: Evaluation[];
  cases: CaseItem[];
  requests: CompanyRequestCard[];
  metrics: { pending: number; alerts: number; complaints: number };
  loading: boolean;
  role: Role;
  name: string;
  go: (value: View) => void;
}) {
  const isCompany = role === "ADMIN_EMPRESA" || role === "USUARIO_DELEGADO";
  const isTechnician = role === "TECNICO_EVALUADOR";
  const workspace = isCompany ? "company" : isTechnician ? "field" : "cases";
  const companyAttention = [...requests]
    .sort((a, b) => companyAttentionRank(a.status) - companyAttentionRank(b.status) || b.id - a.id)
    .slice(0, 4);
  const primaryAction = isCompany
    ? "View requests"
    : isTechnician
      ? "Open field work"
      : "Review assignments";
  const todayLabel = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());
  return (
    <section className="cc">
      <div className="cc-hero">
        <div className="cc-hero-info">
          <small>{title(role)} workspace</small>
          <h1>Good morning, {name}.</h1>
          <p>Here is the operational picture for {todayLabel}.</p>
        </div>
        <button
          type="button"
          className="cc-btn-white"
          onClick={() =>
            go(workspace)
          }
        >
          {primaryAction} <span>→</span>
        </button>
      </div>
      <div className="cc-metrics">
        <Metric
          icon="📂"
          tone="navy"
          label={
            isCompany
              ? "My requests"
              : isTechnician
                ? "Assigned assessments"
                : "Open cases"
          }
          value={isTechnician ? items.length : metrics.pending}
          detail={
            isCompany
              ? "Current BPM submissions"
              : isTechnician
                ? "Ready for field work"
                : "Across all intake channels"
          }
        />
        <Metric
          icon="📅"
          tone="blue"
          label={isCompany ? "Evaluations" : "Scheduled assessments"}
          value={items.length}
          detail="Next 7 days"
        />
        <Metric
          icon="⚠️"
          tone="amber"
          label={isCompany ? "Unread notifications" : "Sanitary alerts"}
          value={metrics.alerts}
          detail={isCompany ? "New activity to review" : "Require triage"}
        />
        <Metric
          icon="📄"
          tone="green"
          label={isTechnician ? "Reports to submit" : "Unresolved reports"}
          value={metrics.complaints}
          detail="Awaiting decision"
        />
      </div>
      <div className="cc-grid">
        <section className="cc-card">
          <div className="cc-card-head">
            <div>
              <small className="eyebrow">Schedule</small>
              <h2>Upcoming assessments</h2>
            </div>
            {!isCompany && (
              <button type="button" className="text" onClick={() => go("calendar")}>
                View calendar →
              </button>
            )}
          </div>
          {loading ? (
            <div className="skeleton">
              <i />
              <i />
              <i />
            </div>
          ) : items.length ? (
            <div className="cc-schedule">
              {items.slice(0, 4).map((item) => (
                <div key={item.evaluationId}>
                  <time>
                    <b>{new Date(item.scheduledDate).getDate()}</b>
                    <small>
                      {new Intl.DateTimeFormat("en", { month: "short" }).format(
                        new Date(item.scheduledDate),
                      )}
                    </small>
                  </time>
                  <span>
                    <b>
                      {item.institution?.name ??
                        `Assessment #${item.evaluationId}`}
                    </b>
                    <small>
                      {date(item.scheduledDate)} · {statusLabel(evaluationLifecycle(item))}
                      {" · "}
                      {item.technician?.person?.name ?? "Evaluator not assigned"}
                    </small>
                  </span>
                  <mark
                    className={item.priority === "ALTA" ? "high" : "medium"}
                  >
                    {title(item.priority ?? "MEDIA")}
                  </mark>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              label="No scheduled assessments yet"
              action={isCompany ? "Review requests" : isTechnician ? "Open field work" : "Open cases"}
              go={() => go(workspace)}
            />
          )}
        </section>
        <section className="cc-card">
          <div className="cc-card-head">
            <div>
              <small className="eyebrow">{isCompany ? "Your requests" : "Priority queue"}</small>
              <h2>{isCompany ? "Company activity" : "Needs attention"}</h2>
            </div>
            {isCompany ? (
              <button type="button" className="text" onClick={() => go("company")}>
                Open portal →
              </button>
            ) : (
              <mark>{cases.length}</mark>
            )}
          </div>
          {isCompany ? (
            companyAttention.length ? (
              <div className="cc-queue">
                {companyAttention.map((item) => (
                  <button
                    type="button"
                    className="cc-attention"
                    key={item.id}
                    onClick={() => go("company")}
                  >
                    <i className={item.status === "EN_CORRECCION" || item.status === "DEVUELTO" || item.status === "RECHAZADA" ? "red" : item.status === "BORRADOR" ? "amber" : "blue"} />
                    <span>
                      <b>{item.name}</b>
                      <small>
                        Request #{item.id} · {companyAttentionDetail(item.status)}
                      </small>
                    </span>
                    →
                  </button>
                ))}
              </div>
            ) : (
              <Empty
                label="No company requests yet"
                action="Open company portal"
                go={() => go("company")}
              />
            )
          ) : cases.length ? (
            <div className="cc-queue">
              {cases.slice(0, 3).map((item) => (
                <button
                  type="button"
                  className="cc-attention"
                  key={item.caseId}
                  onClick={() => go(workspace)}
                >
                  <i className={item.priority === "ALTA" ? "red" : "amber"} />
                  <span>
                    <b>{item.institution?.name ?? `Case #${item.caseId}`}</b>
                    <small>
                      {title(item.origin)} · Case #{item.caseId}
                    </small>
                  </span>
                  →
                </button>
              ))}
            </div>
          ) : (
            <Empty label="Nothing requires immediate action" />
          )}
        </section>
      </div>
      <section className="cc-card">
        <div className="cc-card-head">
          <div>
            <small className="eyebrow">Workflow coverage</small>
            <h2>{isCompany ? "Request progress" : "Case lifecycle"}</h2>
          </div>
        </div>
        <div className="cc-lifecycle">
          {[
            [String(cases.length), "Cases"],
            [String(cases.filter((item) => item.technician || item.technicianId).length), "Assigned"],
            [String(items.filter((item) => evaluationLifecycle(item) === "EN_PROCESO").length), "In field"],
            [String(items.filter((item) => ["EN_REVISION", "EN_CORRECCION", "FINALIZADA"].includes(evaluationLifecycle(item))).length), "Review"],
            [String(items.filter((item) => evaluationLifecycle(item) === "APROBADA").length), "Awaiting closure"],
          ].map(([number, label]) => (
            <span key={label}>
              <b className={number !== "0" ? "done" : ""}>{number}</b>
              <small>{label}</small>
            </span>
          ))}
        </div>
      </section>
    </section>
  );
}
function Metric({
  icon,
  tone,
  label,
  value,
  detail,
}: {
  icon: string;
  tone: string;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <article className="cc-metric">
      <div className={`cc-metric-icon ${tone}`}>{icon}</div>
      <div className="cc-metric-text">
        <span className="cc-metric-label">{label}</span>
        <b className="cc-metric-val">{value}</b>
        <span className="cc-metric-detail">{detail}</span>
      </div>
    </article>
  );
}
function Empty({
  label,
  action,
  go,
}: {
  label: string;
  action?: string;
  go?: () => void;
}) {
  return (
    <div className="empty">
      <span className="empty-mark" aria-hidden="true">○</span>
      <p>{label}</p>
      {action && (
        <button className="text" onClick={go}>
          {action} →
        </button>
      )}
    </div>
  );
}

function Login({
  close,
  success,
}: {
  close: () => void;
  success: (value: Session) => void;
}) {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await authService.login({ usuario, password });
      if (!result.valid) {
        setError(result.error.message);
        return;
      }
      if (result.data.requiresTwoFactor) {
        setError("Two-factor verification is required.");
        return;
      }
      const user = result.data.user as unknown as
        | { person?: { name?: string }; role?: { name?: Role } }
        | undefined;
      success({
        accessToken: result.data.accessToken,
        refreshToken: result.data.refreshToken,
        name: user?.person?.name ?? usuario,
        role: user?.role?.name ?? "COORDINADOR",
      });
    } catch (error) {
      setError(
        errorMessage(
          error,
          "We could not reach the service. Check the API connection and try again.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal">
      <section role="dialog" aria-modal="true">
        <button className="close" onClick={close}>
          ×
        </button>
        <b className="login-mark">R</b>
        <small className="eyebrow">Secure access</small>
        <h2>Welcome to RADAR</h2>
        <p>Sign in with your approved operational account.</p>
        <form onSubmit={submit}>
          <label>
            Email or ID
            <input
              autoFocus
              value={usuario}
              onChange={(event) => setUsuario(event.target.value)}
              required
              placeholder="name@organisation.gov"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              placeholder="Your password"
            />
          </label>
          {error && <em>{error}</em>}
          <button className="primary" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"} →
          </button>
        </form>
        <button
          className="text"
          onClick={() =>
            setError(
              "Password recovery is available through the configured organisation service.",
            )
          }
        >
          Forgot your password?
        </button>
      </section>
    </div>
  );
}
export default App;
