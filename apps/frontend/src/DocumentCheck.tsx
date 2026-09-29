import { useEffect, useRef, useState, type FormEvent } from 'react';
import jsQR from 'jsqr';
import { documentsService } from './services';
import type { DocumentVerification } from '@reto/shared';
import './DocumentCheck.css';

interface DocumentCheckProps {
  token: string;
  signedIn: boolean;
  onClose: () => void;
  onToken: (token: string) => void;
}

interface DetectedBarcode {
  rawValue: string;
}

interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>;
}

function createDetector(): BarcodeDetectorLike | null {
  const ctor = (window as unknown as {
    BarcodeDetector?: new (options: { formats: string[] }) => BarcodeDetectorLike;
  }).BarcodeDetector;
  if (!ctor) return null;
  try {
    return new ctor({ formats: ['qr_code'] });
  } catch {
    return null;
  }
}

function readQrFromCanvas(canvas: HTMLCanvasElement): string | null {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context || canvas.width < 1 || canvas.height < 1) return null;
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' })?.data ?? null;
}

/** Reads a QR from a photo. Several sizes are tried so a page photo and a tight crop both decode. */
async function decodeQrFile(file: File): Promise<string | null> {
  const bitmap = await createImageBitmap(file);
  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    const scales = [1200, 1800, 700, longest]
      .map((edge) => Math.min(1, edge / longest))
      .filter((scale, index, all) => all.indexOf(scale) === index);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    const detector = createDetector();
    for (const scale of scales) {
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const decoded = readQrFromCanvas(canvas);
      if (decoded) return decoded;
      if (!detector) continue;
      try {
        const codes = await detector.detect(canvas);
        const raw = codes.find((code) => code.rawValue)?.rawValue;
        if (raw) return raw;
      } catch {
        // Some browsers reject a canvas even when they can scan a camera frame.
      }
    }
    return null;
  } finally {
    bitmap.close();
  }
}

/** Pulls the seal out of a scanned QR, a verification link, or a pasted token. */
export function tokenFromScan(raw: string): string | null {
  const text = raw.trim();
  if (!text || text === 'scan') return null;
  try {
    const url = new URL(text);
    const fromQuery = url.searchParams.get('verify')?.trim() ?? '';
    if (fromQuery && fromQuery !== 'scan') return fromQuery;
  } catch {
    // Not a URL. A raw seal is still accepted below.
  }
  if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(text)) return text;
  return null;
}

export default function DocumentCheck({ token, signedIn, onClose, onToken }: DocumentCheckProps) {
  const scanning = token === 'scan';
  const [result, setResult] = useState<DocumentVerification | null>(null);
  const [loading, setLoading] = useState(!scanning);
  const [error, setError] = useState('');
  const [cameraOn, setCameraOn] = useState(scanning);
  const [cameraNote, setCameraNote] = useState('');
  const [paste, setPaste] = useState('');
  const [readingPhoto, setReadingPhoto] = useState(false);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (scanning) {
      setResult(null);
      setLoading(false);
      setError('');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    setResult(null);
    void documentsService.verify(token).then((response) => {
      if (cancelled) return;
      if (response.valid) setResult(response.data);
      else setError('This QR could not be checked.');
    }).catch(() => {
      if (!cancelled) setError('The verification service could not be reached. Try again.');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [token, scanning]);

  useEffect(() => {
    if (!cameraOn) return;
    const video = videoRef.current;
    let stopped = false;
    let stream: MediaStream | null = null;
    let frame = 0;

    const stop = () => {
      stopped = true;
      if (frame) cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      if (video) video.srcObject = null;
    };

    void (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraNote('This browser cannot open the camera. Paste the verification link instead.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' } },
        });
      } catch {
        setCameraNote('Camera access was blocked. Allow the camera, or paste the verification link.');
        return;
      }
      if (stopped || !video) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      video.srcObject = stream;
      await video.play();
      const canvas = document.createElement('canvas');
      const tick = () => {
        if (stopped) return;
        const sourceWidth = video.videoWidth;
        const sourceHeight = video.videoHeight;
        if (sourceWidth > 0 && sourceHeight > 0) {
          const scale = Math.min(1, 900 / Math.max(sourceWidth, sourceHeight));
          canvas.width = Math.max(1, Math.round(sourceWidth * scale));
          canvas.height = Math.max(1, Math.round(sourceHeight * scale));
          const context = canvas.getContext('2d', { willReadFrequently: true });
          context?.drawImage(video, 0, 0, canvas.width, canvas.height);
          const decoded = readQrFromCanvas(canvas);
          const found = decoded ? tokenFromScan(decoded) : null;
          if (found) {
            stop();
            onTokenRef.current(found);
            return;
          }
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    })();

    return stop;
  }, [cameraOn]);

  const acceptRaw = (raw: string) => {
    const found = tokenFromScan(raw);
    if (!found) {
      setError('That is not a RADAR verification QR or link.');
      return;
    }
    setError('');
    setCameraOn(false);
    onToken(found);
  };

  const submitPaste = (event: FormEvent) => {
    event.preventDefault();
    acceptRaw(paste);
  };

  const onPhoto = async (file: File | null) => {
    if (!file) return;
    setReadingPhoto(true);
    setError('');
    setCameraOn(false);
    try {
      const raw = await decodeQrFile(file);
      if (!raw) {
        setError('No QR code was found in that photo. Use a clear picture of the code on the report.');
        return;
      }
      const found = tokenFromScan(raw);
      if (!found) {
        setError('That photo has a QR code, but it is not a RADAR verification code.');
        return;
      }
      acceptRaw(raw);
    } catch {
      setError('That photo could not be read. Try a PNG or JPG, or paste the verification link.');
    } finally {
      setReadingPhoto(false);
    }
  };

  const outcome = result?.outcome;

  return (
    <div className="dcheck">
      <header className="dcheck-bar">
        <div className="dcheck-brand">
          <b>R</b>
          <span>RADAR <em>Sanitary</em></span>
        </div>
        <button type="button" className="secondary" onClick={onClose}>
          {signedIn ? 'Back to workspace' : 'Back'}
        </button>
      </header>
      <main className="dcheck-main">
        <section className="dcheck-card">
          <small className="eyebrow">Official document check</small>
          <h1>Verify a RADAR report</h1>
          <p>
            Scan the QR printed on an official inspection report or case report.
            This page confirms whether RADAR Sanitario issued that document.
          </p>

          {loading && <p role="status">Checking this QR…</p>}
          {error && <p className="dcheck-error" role="alert">{error}</p>}

          {result && (
            <article className={`dcheck-result ${result.outcome}`} role="status">
              <span className="dcheck-kicker">
                {outcome === 'confirmed' ? 'Confirmed' : outcome === 'outdated' ? 'Not the current official copy' : 'Not confirmed'}
              </span>
              <strong>
                {outcome === 'confirmed'
                  ? 'Issued by this system'
                  : result.issuedBySystem
                    ? 'Signed by this system, but not current'
                    : 'Not issued by this system'}
              </strong>
              <p>{result.message}</p>
              {result.document && (
                <dl className="dcheck-facts">
                  <div>
                    <dt>Reference</dt>
                    <dd>{result.document.reference}</dd>
                  </div>
                  <div>
                    <dt>Document</dt>
                    <dd>{result.document.title}</dd>
                  </div>
                  <div>
                    <dt>Establishment</dt>
                    <dd>{result.document.establishment}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{result.document.statusLabel}{result.document.version != null ? ` · version ${result.document.version}` : ''}</dd>
                  </div>
                  <div>
                    <dt>Record</dt>
                    <dd>{result.document.summary}</dd>
                  </div>
                </dl>
              )}
            </article>
          )}

          <div className="dcheck-actions">
            <button
              type="button"
              className="primary"
              onClick={() => {
                setCameraNote('');
                setError('');
                if (!scanning) onToken('scan');
                setCameraOn(true);
              }}
            >
              Scan QR
            </button>
            {cameraOn && (
              <button type="button" className="secondary" onClick={() => setCameraOn(false)}>
                Stop camera
              </button>
            )}
          </div>

          {cameraOn && (
            <div className="dcheck-scan">
              <video ref={videoRef} className="dcheck-video" muted playsInline />
              {cameraNote && <p className="dcheck-note">{cameraNote}</p>}
            </div>
          )}

          <form className="dcheck-form" onSubmit={submitPaste}>
            <label htmlFor="verify-paste">Verification link or code</label>
            <input
              id="verify-paste"
              type="text"
              value={paste}
              placeholder="Paste the link from the QR"
              onChange={(event) => setPaste(event.target.value)}
            />
            <button type="submit" className="secondary">Check link</button>
          </form>
          <form className="dcheck-form">
            <label htmlFor="verify-photo">Or choose a photo of the QR</label>
            <input
              id="verify-photo"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              disabled={readingPhoto}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                event.target.value = '';
                void onPhoto(file);
              }}
            />
            {readingPhoto && <p role="status">Reading the photo and checking the QR…</p>}
          </form>
        </section>
      </main>
    </div>
  );
}
