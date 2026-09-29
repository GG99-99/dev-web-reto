import { useState, type FormEvent } from "react";
import { complaintsService } from "./services";

const COMPLAINT_TYPES = [
  "Poor hygienic conditions",
  "Spoiled product",
  "Misleading advertising",
  "Sale of expired food",
  "Unsanitary handling",
  "Other",
] as const;

function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function apiMessage(error: unknown, fallback: string) {
  const message = (
    error as { response?: { data?: { error?: { message?: string } } } }
  )?.response?.data?.error?.message;
  return message || fallback;
}

export default function PublicComplaintPage({
  onClose,
  signedIn = false,
}: {
  onClose: () => void;
  signedIn?: boolean;
}) {
  const [tipo, setTipo] = useState("");
  const [tipoOther, setTipoOther] = useState("");
  const [fecha, setFecha] = useState(todayIso);
  const [anonymous, setAnonymous] = useState(false);
  const [name, setName] = useState("");
  const [place, setPlace] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState<number | null>(null);
  const backLabel = signedIn ? "Back to workspace" : "Back to sign in";

  function resetForm() {
    setTipo("");
    setTipoOther("");
    setFecha(todayIso());
    setAnonymous(false);
    setName("");
    setPlace("");
    setDescripcion("");
    setNotice("");
    setReference(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setNotice("");

    const complaintType = (tipo === "Other" ? tipoOther : tipo).trim();
    const reporter = anonymous ? "Anonymous" : name.trim();
    const details = descripcion.trim();
    const establishment = place.trim();
    const today = todayIso();

    if (!complaintType) {
      setNotice(
        tipo === "Other"
          ? "Describe the type of complaint."
          : "Choose a complaint type.",
      );
      return;
    }
    if (!fecha) {
      setNotice("Enter the date this complaint was received.");
      return;
    }
    if (fecha > today) {
      setNotice("The date received cannot be in the future.");
      return;
    }
    if (!reporter) {
      setNotice("Enter your name, or file the complaint anonymously.");
      return;
    }
    if (details.length < 10) {
      setNotice("Describe what you observed in at least a short sentence.");
      return;
    }

    const descripcionPayload = establishment
      ? `Establishment or place: ${establishment}\n\n${details}`
      : details;

    setBusy(true);
    try {
      const result = await complaintsService.create({
        tipoDenuncia: complaintType,
        fechaRecepcion: `${fecha}T12:00:00.000Z`,
        denunciante: reporter,
        descripcion: descripcionPayload,
      });
      if (!result.valid) {
        setNotice(result.error.message || "The complaint could not be filed.");
        return;
      }
      setReference(result.data.complaintId);
    } catch (error) {
      setNotice(
        apiMessage(
          error,
          "We could not file your complaint. Check your connection and try again.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <header className="auth-header">
        <button type="button" className="auth-brand" onClick={onClose}>
          <b>R</b>
          <span>
            RADAR <em>Sanitary</em>
          </span>
        </button>
        <button type="button" className="auth-help auth-help-btn" onClick={onClose}>
          {backLabel}
        </button>
      </header>
      <section className="auth-layout auth-layout-start">
        <aside className="auth-hero">
          <small className="eyebrow">Public intake</small>
          <h1>
            Report a food safety <em>concern.</em>
          </h1>
          <p>
            Anyone can file a sanitary complaint. A coordinator reviews it and
            decides whether an inspection should follow.
          </p>
          <div className="auth-benefits">
            <p>
              <b>01</b>
              <span>
                <strong>No account required</strong>
                <small>File with your name, or choose to stay anonymous.</small>
              </span>
            </p>
            <p>
              <b>02</b>
              <span>
                <strong>What to include</strong>
                <small>
                  The type of problem, when it happened, and what you observed.
                </small>
              </span>
            </p>
            <p>
              <b>03</b>
              <span>
                <strong>What happens next</strong>
                <small>
                  Intake records the complaint and sets a review result.
                </small>
              </span>
            </p>
          </div>
          <footer>Public intake · Reviewed by a coordinator · RADAR Sanitary</footer>
        </aside>
        <section className="auth-card" aria-live="polite">
          {reference != null ? (
            <>
              <div className="auth-step">
                <span>Public complaint</span>
                <i>Received</i>
              </div>
              <h2>Complaint received</h2>
              <p>
                Your report is in the intake queue. Keep this reference number.
                A coordinator will review it.
              </p>
              <div className="complaint-ref" role="status">
                <span>Reference</span>
                <b>#{reference}</b>
              </div>
              <button type="button" className="primary" onClick={resetForm}>
                File another complaint
              </button>
              <button type="button" className="text auth-link" onClick={onClose}>
                ← {backLabel}
              </button>
            </>
          ) : (
            <>
              <div className="auth-step">
                <span>Public complaint</span>
                <i>No account</i>
              </div>
              <h2>File a public complaint</h2>
              <p>
                This form is open to the public. You do not need to sign in.
              </p>
              {notice && (
                <div className="auth-notice" role="status">
                  {notice}
                </div>
              )}
              <form onSubmit={submit} noValidate>
                <label htmlFor="complaint-type">
                  Complaint type
                  <select
                    id="complaint-type"
                    value={tipo}
                    onChange={(event) => setTipo(event.target.value)}
                    required
                    autoFocus
                  >
                    <option value="">Select a type</option>
                    {COMPLAINT_TYPES.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                {tipo === "Other" && (
                  <label htmlFor="complaint-type-other">
                    Describe the type
                    <input
                      id="complaint-type-other"
                      value={tipoOther}
                      onChange={(event) => setTipoOther(event.target.value)}
                      maxLength={120}
                      placeholder="What kind of problem is this?"
                    />
                  </label>
                )}
                <label htmlFor="complaint-date">
                  Date received
                  <input
                    id="complaint-date"
                    type="date"
                    value={fecha}
                    max={todayIso()}
                    onChange={(event) => setFecha(event.target.value)}
                    required
                  />
                </label>
                <label className="auth-check" htmlFor="complaint-anonymous">
                  <input
                    id="complaint-anonymous"
                    type="checkbox"
                    checked={anonymous}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setAnonymous(checked);
                      if (checked) setName("");
                    }}
                  />
                  File anonymously
                </label>
                <label htmlFor="complaint-name">
                  Your name
                  <input
                    id="complaint-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    disabled={anonymous}
                    maxLength={120}
                    autoComplete="name"
                    placeholder={anonymous ? "Anonymous" : "Your full name"}
                  />
                </label>
                <label htmlFor="complaint-place">
                  Establishment or place
                  <input
                    id="complaint-place"
                    value={place}
                    onChange={(event) => setPlace(event.target.value)}
                    maxLength={200}
                    placeholder="Optional. Name and location if you know them"
                  />
                </label>
                <label htmlFor="complaint-description">
                  What happened
                  <textarea
                    id="complaint-description"
                    value={descripcion}
                    onChange={(event) => setDescripcion(event.target.value)}
                    required
                    maxLength={4000}
                    placeholder="What you saw, which product, and any other detail a reviewer would need."
                  />
                </label>
                <button className="primary" disabled={busy}>
                  {busy ? "Submitting…" : "Submit complaint"} <span>→</span>
                </button>
                <button type="button" className="text auth-link" onClick={onClose}>
                  ← {backLabel}
                </button>
              </form>
            </>
          )}
        </section>
      </section>
    </main>
  );
}
