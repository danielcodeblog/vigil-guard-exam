import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Shield, CheckCircle2, UserPlus, LogIn, Loader2 } from 'lucide-react';

const AdminOnboarding = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [adminExists, setAdminExists] = useState<boolean | null>(null);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    const checkAdmins = async () => {
      const { count, error } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'admin');
      if (!error) setAdminExists((count ?? 0) > 0);
    };
    if (user) checkAdmins();
  }, [user, isAdmin]);

  const handleClaim = async () => {
    setClaiming(true);
    const { data, error } = await supabase.rpc('claim_first_admin');
    setClaiming(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    if (data === true) {
      toast({ title: 'Success', description: 'You are now an admin.' });
      setTimeout(() => navigate('/admin'), 800);
    } else {
      toast({
        title: 'Unavailable',
        description: 'An admin already exists. Ask them to grant you access.',
        variant: 'destructive',
      });
      setAdminExists(true);
    }
  };

  const Step = ({
    n, title, description, done, active, action,
  }: { n: number; title: string; description: string; done: boolean; active: boolean; action?: React.ReactNode }) => (
    <div className={`flex gap-4 p-4 rounded-lg border ${active ? 'border-primary bg-primary/5' : 'border-border'} ${done ? 'opacity-70' : ''}`}>
      <div className="flex-shrink-0">
        {done ? (
          <CheckCircle2 className="h-8 w-8 text-primary" />
        ) : (
          <div className={`h-8 w-8 rounded-full border-2 flex items-center justify-center font-bold ${active ? 'border-primary text-primary' : 'border-muted-foreground text-muted-foreground'}`}>
            {n}
          </div>
        )}
      </div>
      <div className="flex-1">
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
        {active && action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );

  const loading = authLoading || (user && (roleLoading || adminExists === null));

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-800 to-cyan-600 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Admin Onboarding</CardTitle>
          <CardDescription>Set up your admin account in three steps</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <Step
                n={1}
                title="Create your account"
                description="Sign up with your email and password to get started."
                done={!!user}
                active={!user}
                action={
                  <Button onClick={() => navigate('/auth')} className="gap-2">
                    <UserPlus className="h-4 w-4" /> Sign up
                  </Button>
                }
              />
              <Step
                n={2}
                title="Sign in"
                description="Confirm your email if required, then sign in to your account."
                done={!!user}
                active={false}
                action={
                  <Button variant="outline" onClick={() => navigate('/auth')} className="gap-2">
                    <LogIn className="h-4 w-4" /> Sign in
                  </Button>
                }
              />
              <Step
                n={3}
                title="Claim the admin role"
                description={
                  isAdmin
                    ? 'You already have admin access.'
                    : adminExists
                    ? 'An admin already exists. Ask them to grant you the admin role from the admin dashboard.'
                    : 'No admin exists yet. Click below to claim the admin role for your account.'
                }
                done={isAdmin}
                active={!!user && !isAdmin}
                action={
                  isAdmin ? (
                    <Button onClick={() => navigate('/admin')} className="gap-2">
                      <Shield className="h-4 w-4" /> Go to Admin Dashboard
                    </Button>
                  ) : adminExists ? null : (
                    <Button onClick={handleClaim} disabled={claiming} className="gap-2">
                      {claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                      Claim admin role
                    </Button>
                  )
                }
              />

              {isAdmin && (
                <div className="pt-2 text-center">
                  <Button variant="link" onClick={() => navigate('/')}>Back to app</Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminOnboarding;
