import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Shield, ShieldCheck, Sparkles, Loader2, Search, Crown } from "lucide-react";
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
  username: string | null;
  created_at: string;
  kyc_verified: boolean;
  balance: number;
  roles: ('trader' | 'creator' | 'admin')[];
  totalVolume: number;
}

const UserManagementPanel = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      // Fetch profiles
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, email, name, username, created_at, kyc_verified, balance')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Fetch user roles (all roles for each user)
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role');

      const roleMap = new Map<string, ('trader' | 'creator' | 'admin')[]>();
      roles?.forEach(r => {
        const existing = roleMap.get(r.user_id) || [];
        roleMap.set(r.user_id, [...existing, r.role as 'trader' | 'creator' | 'admin']);
      });

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
        username: profile.username,
        created_at: profile.created_at,
        kyc_verified: profile.kyc_verified || false,
        balance: profile.balance || 0,
        roles: roleMap.get(profile.id) || ['trader'],
        totalVolume: volumeMap.get(profile.id) || 0,
      })) as AdminUser[];
    },
    refetchInterval: 60000,
  });

  // Filter users based on search query
  const filteredUsers = users?.filter(user => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.name?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.username?.toLowerCase().includes(query)
    );
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

  const assignRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: 'creator' | 'admin' }) => {
      // Check if role already exists
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .eq('role', role)
        .single();

      if (existingRole) {
        throw new Error(`User already has ${role} role`);
      }

      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({
        title: "Role assigned",
        description: `User is now a ${variables.role}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to assign role",
        variant: "destructive",
      });
    },
  });

  const removeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: 'creator' | 'admin' }) => {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({
        title: "Role removed",
        description: `${variables.role} role has been removed`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove role",
        variant: "destructive",
      });
    },
  });

  const getHighestRole = (roles: string[]): string => {
    if (roles.includes('admin')) return 'admin';
    if (roles.includes('creator')) return 'creator';
    return 'trader';
  };

  if (isLoading) {
    return (
      <Card className="p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, username, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </Card>

      {!filteredUsers || filteredUsers.length === 0 ? (
        <Card className="p-8">
          <div className="text-center">
            <p className="text-muted-foreground">
              {searchQuery ? "No users match your search" : "No users found"}
            </p>
          </div>
        </Card>
      ) : (
        <>
          {/* Mobile: Card layout */}
          <div className="md:hidden space-y-3">
            {filteredUsers.map(user => (
              <Card key={user.id} className="p-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm">{user.name}</p>
                      {user.username && (
                        <p className="text-xs text-muted-foreground">@{user.username}</p>
                      )}
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Joined {format(new Date(user.created_at), "MMM yyyy")}
                      </p>
                    </div>
                    <Badge variant={getHighestRole(user.roles) === "admin" ? "default" : "secondary"}>
                      {getHighestRole(user.roles)}
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
                    {user.roles.includes('creator') && (
                      <Badge variant="outline" className="text-xs">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Creator
                      </Badge>
                    )}
                    {user.roles.includes('admin') && (
                      <Badge variant="outline" className="text-xs border-primary text-primary">
                        <Crown className="h-3 w-3 mr-1" />
                        Admin
                      </Badge>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-border flex-wrap">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline" className="h-9 flex-1">
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

                    {!user.roles.includes('creator') && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" className="h-9 flex-1">
                            <Sparkles className="h-4 w-4 mr-1" />
                            <span className="text-xs">+ Creator</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Assign Creator Role</AlertDialogTitle>
                            <AlertDialogDescription>
                              Grant creator permissions to {user.name}? They will be able to create markets.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => assignRoleMutation.mutate({ userId: user.id, role: 'creator' })}>
                              Assign
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}

                    {user.roles.includes('creator') && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" className="h-9 flex-1 text-destructive border-destructive">
                            <Sparkles className="h-4 w-4 mr-1" />
                            <span className="text-xs">- Creator</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Creator Role</AlertDialogTitle>
                            <AlertDialogDescription>
                              Remove creator permissions from {user.name}? They will no longer be able to create markets.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              className="bg-destructive hover:bg-destructive/90"
                              onClick={() => removeRoleMutation.mutate({ userId: user.id, role: 'creator' })}
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}

                    {!user.roles.includes('admin') && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" className="h-9 flex-1 border-primary text-primary">
                            <Crown className="h-4 w-4 mr-1" />
                            <span className="text-xs">+ Admin</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Assign Admin Role</AlertDialogTitle>
                            <AlertDialogDescription>
                              Grant admin permissions to {user.name}? They will have full platform access including user management and market resolution.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => assignRoleMutation.mutate({ userId: user.id, role: 'admin' })}>
                              Assign Admin
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}

                    {user.roles.includes('admin') && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" className="h-9 flex-1 text-destructive border-destructive">
                            <Crown className="h-4 w-4 mr-1" />
                            <span className="text-xs">- Admin</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Admin Role</AlertDialogTitle>
                            <AlertDialogDescription>
                              Remove admin permissions from {user.name}? They will lose access to admin dashboard and management features.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              className="bg-destructive hover:bg-destructive/90"
                              onClick={() => removeRoleMutation.mutate({ userId: user.id, role: 'admin' })}
                            >
                              Remove Admin
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
                  <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Roles</th>
                  <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Balance</th>
                  <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Volume</th>
                  <th className="text-center py-3 px-2 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => (
                  <tr key={user.id} className="border-b border-border hover:bg-muted/50">
                    <td className="py-4 px-2">
                      <div>
                        <p className="font-medium text-foreground text-sm">{user.name}</p>
                        {user.username && (
                          <p className="text-xs text-muted-foreground">@{user.username}</p>
                        )}
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Joined {format(new Date(user.created_at), "MMM yyyy")}
                        </p>
                      </div>
                    </td>
                    <td className="py-4 px-2">
                      <div className="flex flex-wrap gap-1">
                        {user.roles.includes('admin') && (
                          <Badge variant="default" className="text-xs">
                            <Crown className="h-3 w-3 mr-1" />
                            Admin
                          </Badge>
                        )}
                        {user.roles.includes('creator') && (
                          <Badge variant="secondary" className="text-xs">
                            <Sparkles className="h-3 w-3 mr-1" />
                            Creator
                          </Badge>
                        )}
                        {!user.roles.includes('admin') && !user.roles.includes('creator') && (
                          <Badge variant="outline" className="text-xs">Trader</Badge>
                        )}
                      </div>
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
                      <div className="flex justify-end gap-1 flex-wrap">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline" className="h-8" title="Toggle KYC">
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

                        {!user.roles.includes('creator') ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline" className="h-8" title="Add Creator Role">
                                <Sparkles className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Assign Creator Role</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Grant creator permissions to {user.name}? They will be able to create markets.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => assignRoleMutation.mutate({ userId: user.id, role: 'creator' })}>
                                  Assign
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline" className="h-8 text-destructive border-destructive" title="Remove Creator Role">
                                <Sparkles className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove Creator Role</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Remove creator permissions from {user.name}?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  className="bg-destructive hover:bg-destructive/90"
                                  onClick={() => removeRoleMutation.mutate({ userId: user.id, role: 'creator' })}
                                >
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}

                        {!user.roles.includes('admin') ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline" className="h-8 border-primary text-primary" title="Add Admin Role">
                                <Crown className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Assign Admin Role</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Grant admin permissions to {user.name}? They will have full platform access.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => assignRoleMutation.mutate({ userId: user.id, role: 'admin' })}>
                                  Assign Admin
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline" className="h-8 text-destructive border-destructive" title="Remove Admin Role">
                                <Crown className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove Admin Role</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Remove admin permissions from {user.name}? They will lose admin access.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  className="bg-destructive hover:bg-destructive/90"
                                  onClick={() => removeRoleMutation.mutate({ userId: user.id, role: 'admin' })}
                                >
                                  Remove Admin
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
        </>
      )}
    </div>
  );
};

export default UserManagementPanel;
