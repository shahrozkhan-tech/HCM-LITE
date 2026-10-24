"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2, ShieldCheck, ScanFace, MapPin } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCheckInMutation } from "@/store/api";

const MODEL_URL = "https://cdn.jsdelivr.net/gh/vladmandic/face-api@master/model";

/**
 * Camera check-in (bonus): front camera preview → face detection
 * (exactly one face) → GPS location → server stamps time and verifies
 * the office geofence. Only the result is stored, never a photo.
 */
export function CameraCheckIn({ open, onOpenChange, radius, officeSet = true, onDone }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const loopRef = useRef(null);
  const modelsLoaded = useRef(false);
  const geoRef = useRef(null);

  const [phase, setPhase] = useState("starting"); // starting | scanning | ready | error
  const [error, setError] = useState("");
  const [faceCount, setFaceCount] = useState(0);
  const [geo, setGeo] = useState(null);
  const [checkIn, { isLoading }] = useCheckInMutation();

  const stopEverything = useCallback(() => {
    if (loopRef.current) cancelAnimationFrame(loopRef.current);
    loopRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) {
      stopEverything();
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        setError("");
        setFaceCount(0);
        setGeo(null);
        setPhase("starting");

        // GPS in parallel
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) =>
              !cancelled &&
              setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) }),
            () => !cancelled && setError((e) => e || "Location unavailable — allow GPS access for camera check-in."),
            { enableHighAccuracy: true, timeout: 12000 }
          );
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 480, height: 360 },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        if (!modelsLoaded.current) {
          const faceapi = await import("@vladmandic/face-api");
          await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
          window.__faceapi = faceapi; // reuse on later opens
          modelsLoaded.current = true;
        }
        if (cancelled) return;

        setPhase("scanning");
        const faceapi = window.__faceapi;
        let readyFrames = 0;

        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const det = await faceapi
              .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
              .withFaceLandmarks();
            setFaceCount(det.length);
            if (det.length === 1) readyFrames++;
            else readyFrames = 0;
          } catch {
            /* transient frame errors are fine */
          }
          loopRef.current = requestAnimationFrame(() => setTimeout(tick, 350));
        };
        tick();

        // "ready" is derived in render: faceCount === 1 for a few frames + geo
        const readyCheck = setInterval(() => {
          if (cancelled) return clearInterval(readyCheck);
          if (readyFrames >= 3 && geoRef.current) setPhase("ready");
        }, 400);
        return () => clearInterval(readyCheck);
      } catch (err) {
        if (!cancelled) {
          setPhase("error");
          setError(
            err?.name === "NotAllowedError"
              ? "Camera permission denied. Use web check-in instead."
              : "Could not start camera / face detection. Use web check-in instead."
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      stopEverything();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    geoRef.current = geo;
  }, [geo]);

  const submit = async () => {
    try {
      await checkIn({ source: "camera", faceCount: 1, ...geo }).unwrap();
      onDone?.();
      onOpenChange(false);
    } catch {
      /* toast already shown by base query */
    }
  };

  const ready = officeSet && (phase === "ready" || (faceCount === 1 && geo && phase === "scanning"));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanFace className="h-5 w-5 text-primary" /> Camera check-in
          </DialogTitle>
          <DialogDescription>
            One face in frame + inside office radius ({radius ?? 150} m). Only the result is stored — no photo.
          </DialogDescription>
        </DialogHeader>

        {!officeSet && (
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning-foreground">
            <span className="font-semibold text-warning">Office location not set.</span> Admin must set the office
            latitude/longitude and radius in <b>Organization → Company &amp; rules</b> before camera check-ins are
            accepted (the server checks the geofence). Meanwhile use the regular <b>Check in</b> button.
          </div>
        )}

        <div className="relative overflow-hidden rounded-xl border bg-black">
          <video ref={videoRef} muted playsInline className="w-full aspect-4/3 object-cover" />
          {phase !== "error" && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                className={`h-40 w-40 rounded-xl border-2 transition-colors ${
                  faceCount === 1 ? "border-success shadow-[0_0_30px_rgba(34,197,94,.35)]" : "border-white/40"
                }`}
              />
            </div>
          )}
          {phase === "starting" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white text-sm gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Starting camera & loading face model…
            </div>
          )}
          {phase === "error" && (
            <div className="flex aspect-4/3 items-center justify-center p-6 text-center text-sm text-muted-foreground">
              {error}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant={faceCount === 1 ? "success" : "muted"}>
            <ScanFace className="mr-1 h-3 w-3" /> {faceCount === 1 ? "1 face detected" : `${faceCount} faces`}
          </Badge>
          <Badge variant={geo ? (geo.accuracy <= 100 ? "success" : "warning") : "muted"}>
            <MapPin className="mr-1 h-3 w-3" />
            {geo ? `GPS ±${geo.accuracy} m` : "locating…"}
          </Badge>
          {ready && (
            <Badge variant="info">
              <ShieldCheck className="mr-1 h-3 w-3" /> Inside check conditions
            </Badge>
          )}
        </div>

        <Button onClick={submit} disabled={!ready || isLoading || !geo} className="w-full gap-2">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          {ready ? "Check in with camera" : "Waiting for face + location…"}
        </Button>
        {!geo && phase !== "error" && (
          <p className="text-center text-xs text-muted-foreground">Allow location access — required for the office geofence.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
