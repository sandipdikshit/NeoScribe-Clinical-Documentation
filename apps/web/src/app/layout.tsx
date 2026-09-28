import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import GoogleAnalytics from "@/shared/components/utils/GoogleAnalytics";
import ClarityProvider from "@/shared/components/utils/ClarityProvider";
import { Suspense } from "react";
import ReduxProvider from "@/shared/components/providers/ReduxProvider";


const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "NeoScribe",
  description: "NeoScribe is a note-taking app that uses AI to analyze your notes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID || '';
  const clarityId = process.env.CLARITY_PROJECT_ID || '';

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ReduxProvider>
          <Suspense>
            {children}
          </Suspense>
          <GoogleAnalytics gaId={gaId} />
          <ClarityProvider clarityId={clarityId} />
        </ReduxProvider>
      </body>
    </html>
  );
}
