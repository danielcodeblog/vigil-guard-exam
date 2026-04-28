import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ShieldCheck } from 'lucide-react';

const AdminAuth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const verifyAdmin = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();
    if (error) throw error;
    return !!data;
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        try {
          const isAdmin = await verifyAdmin(session.user.id);
          if (isAdmin) navigate('/admin');
        } catch {
          // ignore
        }
      }
    });
  }, [navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast({ title: 'Sign In Error', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    try {
      const isAdmin = await verifyAdmin(data.user!.id);
      if (!isAdmin) {
        await supabase.auth.signOut();
        toast({
          title: 'Access Denied',
          description: 'This account does not have admin privileges.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }
      toast({ title: 'Welcome, Admin', description: 'Signed in successfully.' });
      navigate('/admin');
    } catch (err: any) {
      toast({ title: 'Verification Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8"
      style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' }}
    >
      <div className="w-full max-w-md mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/10 backdrop-blur mb-4">
            <ShieldCheck className="w-8 h-8 text-cyan-300" />
          </div>
          <h1 className="text-4xl font-extrabold font-display text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-indigo-400 mb-2">
            Admin Portal
          </h1>
          <p className="text-base text-white/70 font-medium">Restricted access — administrators only</p>
        </div>
        <Card className="backdrop-blur-lg bg-white/10 border border-white/20 shadow-2xl rounded-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-white">Admin Sign In</CardTitle>
            <CardDescription className="text-base text-white/70">
              Use your administrator credentials
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignIn} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="admin-email" className="text-white font-semibold">Email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password" className="text-white font-semibold">Password</Label>
                <Input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-600 hover:to-indigo-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-all"
                disabled={loading}
              >
                {loading ? 'Verifying...' : 'Sign In as Admin'}
              </Button>
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => navigate('/auth')}
                  className="text-sm text-white/60 hover:text-white underline"
                >
                  Not an admin? Go to student sign in
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminAuth;
