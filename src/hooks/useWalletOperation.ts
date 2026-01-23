import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface WalletOperationResult {
  success: boolean;
  newBalance?: number;
  previousBalance?: number;
  transactionId?: string;
  version?: number;
  error?: string;
  cached?: boolean;
}

interface UseWalletOperationReturn {
  deposit: (amount: number) => Promise<WalletOperationResult>;
  withdraw: (amount: number) => Promise<WalletOperationResult>;
  isProcessing: boolean;
  currentVersion: number | null;
}

// Generate a unique idempotency key for this operation
function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

export function useWalletOperation(): UseWalletOperationReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<number | null>(null);
  const { toast } = useToast();
  const pendingOperationsRef = useRef<Set<string>>(new Set());

  const executeOperation = useCallback(async (
    operation: 'deposit' | 'withdrawal',
    amount: number
  ): Promise<WalletOperationResult> => {
    // Generate idempotency key for deduplication
    const idempotencyKey = generateIdempotencyKey();
    
    // Check if we already have a pending operation with similar parameters
    const operationKey = `${operation}-${amount}`;
    if (pendingOperationsRef.current.has(operationKey)) {
      return {
        success: false,
        error: 'A similar operation is already in progress'
      };
    }

    pendingOperationsRef.current.add(operationKey);
    setIsProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke('wallet-operations', {
        body: {
          operation,
          amount,
          idempotencyKey,
          expectedVersion: currentVersion // Send current version for optimistic locking
        }
      });

      if (error) throw error;

      if (data?.success) {
        // Update the local version for next operation
        if (data.version) {
          setCurrentVersion(data.version);
        }

        // Show different toast if it was a cached (duplicate) response
        if (data.cached) {
          toast({
            title: "Operation already processed",
            description: `This ${operation} was already completed.`,
          });
        }

        return {
          success: true,
          newBalance: data.newBalance,
          previousBalance: data.previousBalance,
          transactionId: data.transactionId,
          version: data.version,
          cached: data.cached
        };
      } else {
        throw new Error(data?.error || 'Operation failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      
      // Handle version conflict (optimistic locking failure)
      if (errorMessage.includes('VERSION_CONFLICT') || errorMessage.includes('Concurrent modification')) {
        // Fetch the latest version and prompt retry
        const { data: profile } = await supabase
          .from('profiles')
          .select('version')
          .single();
        
        if (profile?.version) {
          setCurrentVersion(profile.version);
        }

        toast({
          title: "Transaction conflict",
          description: "Your balance was updated elsewhere. Please try again.",
          variant: "destructive",
        });

        return {
          success: false,
          error: 'Version conflict - please retry'
        };
      }

      return {
        success: false,
        error: errorMessage
      };
    } finally {
      pendingOperationsRef.current.delete(operationKey);
      setIsProcessing(false);
    }
  }, [currentVersion, toast]);

  const deposit = useCallback((amount: number) => 
    executeOperation('deposit', amount), [executeOperation]);

  const withdraw = useCallback((amount: number) => 
    executeOperation('withdrawal', amount), [executeOperation]);

  return {
    deposit,
    withdraw,
    isProcessing,
    currentVersion
  };
}
