"use client";

import { AlertTriangle, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Friendly deployment-configuration error — shows exactly which env vars
 * the Vercel project is missing, instead of a white crash screen.
 */
export function ConfigBanner({ missing, extra = [] }) {
  const vars = [...missing, ...extra];
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-lg animate-scale-in border-destructive/40">
        <CardContent className="p-6">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-extrabold">Deployment not configured yet</h1>
              <p className="text-xs text-muted-foreground">
                The app is deployed but its environment variables are missing on this host.
              </p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Vercel par jao: <b>Project → Settings → Environment Variables</b>, neeche ki saari
            variables add karo (values tumhare local <code className="rounded bg-muted px-1">.env.local</code> mein hain), phir{" "}
            <b>Deployments → Redeploy</b> karo. Secrets kabhi git mein nahi jati, is liye yeh
            manually ek dafa karna parta hai.
          </p>

          <div className="mt-4 space-y-1.5 rounded-xl border bg-muted/40 p-3 font-mono text-xs">
            {vars.map((v) => (
              <div key={v} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                {v}
                <span className="ml-auto font-sans text-[10px] text-muted-foreground">
                  {v.startsWith("NEXT_PUBLIC") ? "required (build time)" : "required (server)"}
                </span>
              </div>
            ))}
          </div>

          <a
            href="https://vercel.com/dashboard"
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            Open Vercel dashboard <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
