import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import ExamInterface from '@/components/ExamInterface';

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-800 to-cyan-600">
        <div className="text-white text-xl font-bold">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-gradient-to-br from-purple-900 via-blue-800 to-cyan-600">
        <div className="w-full max-w-md mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold gradient-primary bg-clip-text text-transparent text-shadow mb-2">
              XhosaProc
            </h1>
            <p className="text-lg text-cyan-100">Advanced AI Proctoring System</p>
          </div>
          
          <Card className="hover-lift glass-effect border-primary/20 shadow-xl">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl text-blue-100">Welcome Back</CardTitle>
              <CardDescription className="text-base text-cyan-200">
                Please sign in to access your secure examinations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => navigate('/auth')} 
                className="w-full text-lg py-6 gradient-primary hover:opacity-90 transition-all duration-300"
                size="lg"
              >
                Sign In to Xhosa
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-800 to-cyan-600">
      <header className="glass-effect border-b border-primary/20 backdrop-blur-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl sm:text-3xl font-display font-bold gradient-primary bg-clip-text text-transparent">
                XHOSA
              </h1>
              <div className="hidden sm:block w-px h-6 bg-primary/30"></div>
              <span className="hidden sm:inline text-sm text-cyan-100">AI Proctoring System</span>
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-4">
              <span className="text-sm text-cyan-100 hidden sm:inline truncate max-w-32 lg:max-w-none">
                {user.email}
              </span>
              <Button 
                variant="outline" 
                onClick={signOut}
                className="border-cyan-200 hover:bg-cyan-900/10 text-cyan-100 transition-all duration-300"
                size="sm"
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
