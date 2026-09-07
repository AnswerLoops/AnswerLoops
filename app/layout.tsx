import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { siteIdentityJsonLd } from '@/lib/site-identity'
import { jsonLdHtml } from '@/lib/marketing/json-ld'
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://answerloops.com'),
  title: "AnswerLoops",
  description:
    "Someone in your community asks a question you've already answered. The AnswerLoops agent answers it again, right in your community channel — Discord, Slack, Discourse and Circle forums, GitHub, Telegram, email, and website chat — grounded in your knowledge, and checked by a second agent before it's confident enough to be right. Open source, self-hosted, and MCP/API-ready.",
  openGraph: {
    type: 'website',
    siteName: 'AnswerLoops',
    title: 'AnswerLoops — Support that lives in your community',
    description:
      "Your community keeps asking questions you've already answered. The AnswerLoops agent remembers, and answers them again in your community channel — Discord, Slack, GitHub, and more — checked by a second agent before it posts. Open source, self-hosted, and MCP/API-ready.",
    // Social card image comes from app/opengraph-image.tsx (1200×630) via the
    // Next file convention — it fills both openGraph and twitter automatically.
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AnswerLoops — Support that lives in your community',
    description:
      "Your community keeps asking questions you've already answered. The AnswerLoops agent remembers, and answers them again in your community channel — Discord, Slack, GitHub, and more — checked by a second agent before it posts. Open source, self-hosted, and MCP/API-ready.",
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32', type: 'image/x-icon' },
      { url: '/icon.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: { url: '/icon.png', sizes: '512x512', type: 'image/png' },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background font-sans text-foreground antialiased">
        {/* nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml */}
        {/* siteIdentityJsonLd is a static server-defined constant, never user input; jsonLdHtml escapes `<` so the payload can't break out of the script tag. */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(siteIdentityJsonLd) }} />
        {children}
      </body>
    </html>
  );
}
