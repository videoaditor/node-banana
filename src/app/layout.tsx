import type { Metadata } from "next";
import "./globals.css";
import { Toast } from "@/components/Toast";

export const metadata: Metadata = {
  title: "Node Banana - AI Image Workflow",
  description: "Node-based image annotation and generation workflow using Nano Banana Pro",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased font-['Inter',system-ui,sans-serif]">
        {children}
        <Toast />
      </body>
    </html>
  );
}
