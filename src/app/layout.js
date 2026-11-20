import { Schibsted_Grotesk } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { SidebarProvider } from "@/context/SidebarContext";
import { FollowUpCountProvider } from "@/context/FollowUpCountContext";

const schibsted = Schibsted_Grotesk({
  variable: "--font-schibsted",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata = {
  title: "Missions Consol App",
  description: "Ministry contact management app",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${schibsted.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-white font-sans text-ink">
        <AuthProvider>
          <SidebarProvider>
            <FollowUpCountProvider>{children}</FollowUpCountProvider>
          </SidebarProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
