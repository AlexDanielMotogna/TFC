'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks';
import { AppShell } from '@/components/AppShell';
import { BetaGate } from '@/components/BetaGate';
import PersonIcon from '@mui/icons-material/Person';

export default function ProfilePage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();

  // Redirect to user's profile when authenticated
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      router.replace(`/profile/${user.id}`);
    }
  }, [isAuthenticated, user?.id, router]);

  // Set page title
  useEffect(() => {
    document.title = 'Profile - Trading Fight Club';
  }, []);

  // Show connect wallet message when not authenticated
  if (!isAuthenticated) {
    return (
      <BetaGate>
        <AppShell>
          <div className="container mx-auto px-2 md:px-6 py-8">
            <div className="card p-12 text-center">
              <PersonIcon sx={{ fontSize: 64, color: '#52525b', marginBottom: 16 }} />
              <h3 className="text-lg font-semibold text-surface-300 mb-2">Connect your wallet</h3>
              <p className="text-surface-500">Please connect your wallet to view your profile.</p>
            </div>
          </div>
        </AppShell>
      </BetaGate>
    );
  }

  // Show loading while redirecting
  return (
    <BetaGate>
      <AppShell>
        <div className="container mx-auto px-2 md:px-6 py-8">
          <div className="animate-pulse space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-24 h-24 bg-surface-700 rounded-full" />
              <div>
                <div className="h-6 w-40 bg-surface-700 mb-2" />
                <div className="h-4 w-32 bg-surface-700" />
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    </BetaGate>
  );
}
