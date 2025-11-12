import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminUser } from "@/types/admin";
import { Shield, ShieldCheck, Ban, TrendingUp, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
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

interface UserManagementPanelProps {
  users: AdminUser[];
  onToggleKYC: (id: string) => void;
  onToggleBan: (id: string) => void;
  onPromoteToCreator: (id: string) => void;
}

const UserManagementPanel = ({ 
  users, 
  onToggleKYC, 
  onToggleBan, 
  onPromoteToCreator 
}: UserManagementPanelProps) => {
  const { toast } = useToast();

  const handleToggleKYC = (user: AdminUser) => {
    onToggleKYC(user.id);
    toast({
      title: user.kycVerified ? "KYC verification removed" : "KYC verified",
      description: `${user.name} is ${user.kycVerified ? "no longer" : "now"} verified`,
    });
  };

  const handleToggleBan = (user: AdminUser) => {
    onToggleBan(user.id);
    toast({
      title: user.isBanned ? "User unbanned" : "User banned",
      description: `${user.name} has been ${user.isBanned ? "unbanned" : "banned"}`,
      variant: user.isBanned ? "default" : "destructive",
    });
  };

  const handlePromoteToCreator = (user: AdminUser) => {
    onPromoteToCreator(user.id);
    toast({
      title: "User promoted",
      description: `${user.name} can now create markets`,
    });
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
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
                      Joined {format(new Date(user.signupDate), "MMM yyyy")}
                    </p>
                  </div>
                </td>
                <td className="py-4 px-2">
                  <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                    {user.role}
                  </Badge>
                </td>
                <td className="py-4 px-2 text-right text-sm">
                  {user.balance.toLocaleString()}
                </td>
                <td className="py-4 px-2 text-right text-sm">
                  {user.totalVolume.toLocaleString()}
                </td>
                <td className="py-4 px-2">
                  <div className="flex flex-col items-center gap-1">
                    {user.kycVerified && (
                      <Badge className="bg-green-600 text-xs">
                        <ShieldCheck className="h-3 w-3 mr-1" />
                        KYC
                      </Badge>
                    )}
                    {user.isBanned && (
                      <Badge variant="destructive" className="text-xs">
                        <Ban className="h-3 w-3 mr-1" />
                        Banned
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
                            {user.kycVerified 
                              ? `Remove KYC verification for ${user.name}?`
                              : `Mark ${user.name} as KYC verified?`
                            }
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleToggleKYC(user)}>
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
                            <AlertDialogAction onClick={() => handlePromoteToCreator(user)}>
                              Promote
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          size="sm" 
                          variant={user.isBanned ? "default" : "destructive"}
                          className="h-8"
                        >
                          <Ban className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {user.isBanned ? "Unban User" : "Ban User"}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {user.isBanned 
                              ? `Restore access for ${user.name}?`
                              : `Ban ${user.name} from the platform? They will not be able to login.`
                            }
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleToggleBan(user)}
                            className={user.isBanned ? "" : "bg-destructive text-destructive-foreground"}
                          >
                            {user.isBanned ? "Unban" : "Ban"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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
