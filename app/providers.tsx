"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      {children}
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: "hsl(240 6% 9%)",
            border: "1px solid hsl(240 5% 15%)",
            color: "hsl(0 0% 92%)",
          },
        }}
      />
    </ThemeProvider>
  );
}
