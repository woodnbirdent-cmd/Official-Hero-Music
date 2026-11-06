"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { redeemCheckin } from "@/app/checkin/actions";
import { parseTicketCode } from "@/lib/show-codes";
import type { RedeemResult } from "@/lib/show-types";

const inflightRedeems = new Map<string, Promise<RedeemResult>>();

function redeemInitial(code: string): Promise<RedeemResult> {
  const existing = inflightRedeems.get(code);
  if (existing) return existing;
  const promise = redeemCheckin(code);
  inflightRedeems.set(code, promise);
  return promise;
}

type Detector = {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
};

export default function CheckinDesk({ initialCode }: { initialCode: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [manual, setManual] = useState("");
  const [result, setResult] = useState<RedeemResult | null>(null);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [cameraNote, setCameraNote] = useState("");

  useEffect(() => {
    if (!initialCode) return;
    let cancel = false;
    void redeemInitial(initialCode)
      .then((next) => {
        if (!cancel) setResult(next);
      })
      .catch(() => {
        if (!cancel) setError("Could not check that code.");
      });
    return () => {
      cancel = true;
    };
  }, [initialCode]);

  useEffect(() => {
    if (!scanning) return;
    const video = videoRef.current;
    if (!video) return;
    let stop = false;
    let stream: MediaStream | null = null;
    const DetectorCtor = (
      window as unknown as { BarcodeDetector?: new (options: { formats: string[] }) => Detector }
    ).BarcodeDetector;

    async function loop(detector: Detector) {
      if (stop || !video) return;
      try {
        const codes = await detector.detect(video);
        const raw = codes.find((code) => code.rawValue)?.rawValue;
        const parsed = raw ? parseTicketCode(raw) : null;
        if (parsed) {
          stop = true;
          stream?.getTracks().forEach((track) => track.stop());
          setScanning(false);
          const next = await redeemCheckin(parsed);
          setResult(next);
          return;
        }
      } catch {
        // Keep scanning while the camera warms up.
      }
      window.setTimeout(() => void loop(detector), 200);
    }

    async function start() {
      if (!DetectorCtor || !navigator.mediaDevices?.getUserMedia) {
        setCameraNote("This browser cannot scan QR codes. Type the code under the QR image.");
        setScanning(false);
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (stop) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const node = videoRef.current;
        if (!node) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        node.srcObject = stream;
        await node.play();
        await loop(new DetectorCtor({ formats: ["qr_code"] }));
      } catch {
        setCameraNote("Camera permission is off. Type the code instead.");
        setScanning(false);
      }
    }

    void start();
    return () => {
      stop = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [scanning]);

  async function submitManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      setResult(await redeemCheckin(manual));
    } catch {
      setError("Could not check that code.");
    }
  }

  return (
    <div className="space-y-6 pb-28">
      {result && result.status !== "locked" && (
        <section
          data-checkin-status={result.status}
          className={`border-4 p-5 ${
            result.status === "valid" ? "border-white" : result.status === "used" ? "border-hero-accent" : "border-hero-gray"
          }`}
        >
          <p
            className={`font-display text-6xl leading-none sm:text-7xl ${
              result.status === "used" ? "text-hero-accent" : "text-white"
            }`}
          >
            {result.status === "valid" ? "VALID" : result.status === "used" ? "ALREADY USED" : "NOT FOUND"}
          </p>
          {(result.status === "valid" || result.status === "used") && (
            <>
              <p className="mt-4 text-xl font-bold uppercase tracking-wide">{result.tierName}</p>
              {result.status === "used" && <p className="mt-2 text-2xl font-black">{result.redeemedLabel}</p>}
              <div className="mt-5 space-y-3">
                {result.flags.map((flag) => (
                  <div key={flag.id} data-flag={flag.flag} className="border-4 border-white bg-white px-4 py-4 text-black">
                    <p className="font-display text-4xl leading-none sm:text-5xl">{flag.flag}</p>
                    {flag.detail && <p className="mt-2 text-xl font-bold uppercase">{flag.detail}</p>}
                    {flag.size && <p className="mt-2 text-3xl font-black">Size {flag.size}</p>}
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}
      {result?.status === "locked" && (
        <p className="text-sm text-hero-accent" role="alert">
          Enter the door password again.
        </p>
      )}
      {error && (
        <p className="text-sm text-hero-accent" role="alert">
          {error}
        </p>
      )}
      <div className="space-y-3">
        <button type="button" className="btn-primary w-full" onClick={() => setScanning((value) => !value)}>
          {scanning ? "Stop camera" : "Scan QR"}
        </button>
        {cameraNote && <p className="text-sm text-hero-muted">{cameraNote}</p>}
        {scanning && <video ref={videoRef} className="aspect-[3/4] w-full bg-hero-dark object-cover" muted playsInline />}
      </div>
      <form onSubmit={submitManual} className="space-y-3">
        <label className="block text-sm">
          <span className="section-label mb-2 block">Or type the code</span>
          <input
            className="input-field text-lg tracking-wider"
            value={manual}
            onChange={(event) => setManual(event.target.value)}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>
        <button type="submit" className="btn-ghost w-full">
          Check code
        </button>
      </form>
    </div>
  );
}
