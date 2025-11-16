import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import ExamInterface from '@/components/ExamInterface';
import { Shield } from 'lucide-react';

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-800 to-cyan-600">
        <div className="text-white text-xl font-bold">Loading...</div>
      </div>
    );
  }

  if (!user) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-800 to-cyan-600">
      <header className="glass-effect border-b border-primary/20 backdrop-blur-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl sm:text-3xl font-display font-bold bg-clip-text text-white drop-shadow-lg">
                XHORA
              </h1>
              <div className="hidden sm:block w-px h-6 bg-white/40"></div>
              <span className="hidden sm:inline text-sm text-white/90 font-semibold">AI Proctoring System</span>
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-4">
              <span className="text-sm text-white/90 font-semibold hidden sm:inline truncate max-w-32 lg:max-w-none">
                {user.email}
              </span>
              {isAdmin && (
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/admin')}
                  className="gap-2"
                >
                  <Shield className="h-4 w-4" />
                  <span className="hidden sm:inline">Admin</span>
                </Button>
              )}
              <Button 
                variant="outline" 
                onClick={signOut}
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <ExamInterface userId={user.id} />
      </main>
    </div>
  );
};

export default Index;
