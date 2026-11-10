import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Suspense } from 'react'
import { Geist, JetBrains_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/lib/theme-context'
import { ProjectProvider } from '@/lib/project-context'
import { LayoutContent } from '@/components/layout-content'
import { AppUrlStateSync } from '@/components/app-url-state-sync'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' })

export const metadata: Metadata = {
  title: 'LogSpectra — AI Log Analysis',
  description: 'Search, stream, and triage microservice logs with AI-assisted root cause analysis.',
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

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f8fb' },
    { media: '(prefers-color-scheme: dark)', color: '#080c10' },
  ],
}

const themeInitScript = `try{var t=localStorage.getItem('theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');var d=document.documentElement;d.classList.toggle('dark',t==='dark');d.style.colorScheme=t}catch(e){}`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geist.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased bg-background text-foreground">
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
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
