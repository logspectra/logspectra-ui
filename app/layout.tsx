import type { Metadata } from 'next'
import Script from 'next/script'
import { Suspense } from 'react'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/lib/theme-context'
import { ProjectProvider } from '@/lib/project-context'
import { LayoutContent } from '@/components/layout-content'
import { AppUrlStateSync } from '@/components/app-url-state-sync'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'LogSpectra - AI Log Analyzer Dashboard',
  description: 'Production-grade AI-powered log analysis and monitoring dashboard',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased bg-background text-foreground">
        <Script src="/env-config.js" strategy="beforeInteractive" />
        <ThemeProvider>
          <ProjectProvider>
            <Suspense fallback={null}>
              <AppUrlStateSync />
            </Suspense>
            <LayoutContent>{children}</LayoutContent>
          </ProjectProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
