import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { FirebaseClientProvider } from '@/firebase/client-provider';
<<<<<<< HEAD
import { UserProvider } from '@/firebase/auth/use-user';
=======
import { FirebaseErrorListener } from '@/components/firebase-error-listener';
>>>>>>> 493f64cf071699c798704dd512006dc35618f02c

export const metadata: Metadata = {
  title: 'SRI LAKSHMI WAREHOUSE',
  description: 'Warehouse Rent Calculation App',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased bg-background">
        <FirebaseClientProvider>
<<<<<<< HEAD
          <UserProvider>
            {children}
            <Toaster />
          </UserProvider>
=======
          {children}
          <Toaster />
          <FirebaseErrorListener />
>>>>>>> 493f64cf071699c798704dd512006dc35618f02c
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
