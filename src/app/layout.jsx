import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { StoreProvider } from "@/store/provider";
import { PwaRegister } from "@/components/pwa-register";
import { Toaster } from "sonner";

export const metadata = {
  title: "HCM Lite — Human Capital Management",
  description: "AI-assisted HR for Admin, HR and Employees",
  manifest: "/manifest.webmanifest",
  themeColor: "#6366f1",
  appleWebApp: { capable: true, title: "HCM Lite", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport = {
  themeColor: "#6366f1",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <StoreProvider>
            {children}
            <Toaster richColors position="top-right" closeButton />
          </StoreProvider>
        </ThemeProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
