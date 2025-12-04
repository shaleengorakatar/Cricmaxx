import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, ShieldCheck, Ban, Sparkles, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface AdminUser {
  id: string;
  email: string;
  name: string;
  created_at: string;
  kyc_verified: boolean;
  balance: number;
  role: 'trader' | 'creator' | 'admin';
  totalVolume: number;
}

const UserManagementPanel = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      // Fetch profiles
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, email, name, created_at, kyc_verified, balance')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Fetch user roles
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role');

      const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);

      // Fetch total volume per user from positions
      const { data: positions } = await supabase
        .from('positions')
        .select('user_id, size, entry_price');

      const volumeMap = new Map<string, number>();
      positions?.forEach(p => {
        const current = volumeMap.get(p.user_id) || 0;
        volumeMap.set(p.user_id, current + (Number(p.size) * Number(p.entry_price)));
      });

      return profiles?.map(profile => ({
        id: profile.id,
        email: profile.email,
        name: profile.name,
        created_at: profile.created_at,
        kyc_verified: profile.kyc_verified || false,
        balance: profile.balance || 0,
        role: (roleMap.get(profile.id) || 'trader') as 'trader' | 'creator' | 'admin',
        totalVolume: volumeMap.get(profile.id) || 0,
      })) as AdminUser[];
    },
    refetchInterval: 60000,
  });

  const toggleKYCMutation = useMutation({
    mutationFn: async ({ userId, currentStatus }: { userId: string; currentStatus: boolean }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ kyc_verified: !currentStatus })
        .eq('id', userId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({
        title: variables.currentStatus ? "KYC verification removed" : "KYC verified",
        description: `User is ${variables.currentStatus ? "no longer" : "now"} verified`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update KYC status",
        variant: "destructive",
      });
    },
  });

  const promoteToCreatorMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Check if role already exists
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .eq('role', 'creator')
        .single();

      if (existingRole) return; // Already a creator

      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: 'creator' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({
        title: "User promoted",
        description: "User can now create markets",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to promote user",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card className="p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </Card>
    );
  }

  if (!users || users.length === 0) {
    return (
      <Card className="p-8">
        <div className="text-center">
          <p className="text-muted-foreground">No users found</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3 md:space-y-4">
      {/* Mobile: Card layout */}
      <div className="md:hidden space-y-3">
        {users.map(user => (
          <Card key={user.id} className="p-4">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm">{user.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Joined {format(new Date(user.created_at), "MMM yyyy")}
                  </p>
                </div>
                <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                  {user.role}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Balance</p>
                  <p className="font-medium">${user.balance.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Volume</p>
                  <p className="font-medium">${user.totalVolume.toLocaleString()}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {user.kyc_verified && (
                  <Badge className="bg-green-600 text-xs">
                    <ShieldCheck className="h-3 w-3 mr-1" />
                    KYC
                  </Badge>
                )}
              </div>

              <div className="flex gap-2 pt-2 border-t border-border">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" className="h-10 flex-1">
                      <Shield className="h-4 w-4 mr-1" />
                      <span className="text-xs">KYC</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Toggle KYC Verification</AlertDialogTitle>
                      <AlertDialogDescription>
                        {user.kyc_verified 
                          ? `Remove KYC verification for ${user.name}?`
                          : `Mark ${user.name} as KYC verified?`
                        }
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => toggleKYCMutation.mutate({ userId: user.id, currentStatus: user.kyc_verified })}
                      >
                        Confirm
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                {user.role === "trader" && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline" className="h-10 flex-1">
                        <Sparkles className="h-4 w-4 mr-1" />
                        <span className="text-xs">Creator</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Promote to Creator</AlertDialogTitle>
                        <AlertDialogDescription>
                          Grant creator permissions to {user.name}? They will be able to create markets.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => promoteToCreatorMutation.mutate(user.id)}>
                          Promote
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Desktop: Table layout */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">User</th>
              <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Role</th>
              <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Balance</th>
              <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Volume</th>
              <th className="text-center py-3 px-2 text-sm font-medium text-muted-foreground">Status</th>
              <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-b border-border hover:bg-muted/50">
                <td className="py-4 px-2">
                  <div>
                    <p className="font-medium text-foreground text-sm">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Joined {format(new Date(user.created_at), "MMM yyyy")}
                    </p>
                  </div>
                </td>
                <td className="py-4 px-2">
                  <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                    {user.role}
                  </Badge>
                </td>
                <td className="py-4 px-2 text-right text-sm">
                  ${user.balance.toLocaleString()}
                </td>
                <td className="py-4 px-2 text-right text-sm">
                  ${user.totalVolume.toLocaleString()}
                </td>
                <td className="py-4 px-2">
                  <div className="flex flex-col items-center gap-1">
                    {user.kyc_verified && (
                      <Badge className="bg-green-600 text-xs">
                        <ShieldCheck className="h-3 w-3 mr-1" />
                        KYC
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="py-4 px-2">
                  <div className="flex justify-end gap-1">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline" className="h-8">
                          <Shield className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Toggle KYC Verification</AlertDialogTitle>
                          <AlertDialogDescription>
                            {user.kyc_verified 
                              ? `Remove KYC verification for ${user.name}?`
                              : `Mark ${user.name} as KYC verified?`
                            }
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => toggleKYCMutation.mutate({ userId: user.id, currentStatus: user.kyc_verified })}
                          >
                            Confirm
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    {user.role === "trader" && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" className="h-8">
                            <Sparkles className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Promote to Creator</AlertDialogTitle>
                            <AlertDialogDescription>
                              Grant creator permissions to {user.name}? They will be able to create markets.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => promoteToCreatorMutation.mutate(user.id)}>
                              Promote
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserManagementPanel;
