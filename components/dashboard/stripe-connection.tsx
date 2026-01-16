'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CreditCard, 
  RefreshCw, 
  Unplug, 
  Check, 
  AlertCircle,
  Clock,
  Key,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { getRelativeTime } from '@/lib/utils';

interface StripeConnectionProps {
  isConnected: boolean;
  connection?: {
    accountId: string;
    livemode: boolean;
    connectedAt: string;
    lastSyncAt?: string;
    lastSyncStatus?: string;
    lastSyncError?: string;
  };
  onConnect: () => void;
  onDisconnect: () => void;
  onSync: () => void;
  isConnecting?: boolean;
  isSyncing?: boolean;
  onDirectConnect?: (apiKey: string) => Promise<void>;
  supportsDirectConnect?: boolean;
}

export function StripeConnection({
  isConnected,
  connection,
  onConnect,
  onDisconnect,
  onSync,
  isConnecting,
  isSyncing,
  onDirectConnect,
  supportsDirectConnect,
}: StripeConnectionProps) {
  const [showDisconnect, setShowDisconnect] = useState(false);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [isDirectConnecting, setIsDirectConnecting] = useState(false);
  const [directConnectError, setDirectConnectError] = useState<string | null>(null);

  const handleDirectConnect = async () => {
    if (!apiKey.trim() || !onDirectConnect) return;
    
    setIsDirectConnecting(true);
    setDirectConnectError(null);
    
    try {
      await onDirectConnect(apiKey.trim());
      setApiKey('');
      setShowApiKeyInput(false);
    } catch (error) {
      setDirectConnectError(error instanceof Error ? error.message : 'Connection failed');
    } finally {
      setIsDirectConnecting(false);
    }
  };

  if (!isConnected) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-xl border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 p-8 text-center"
      >
        <div className="mx-auto w-fit rounded-full bg-primary/20 p-4">
          <CreditCard className="h-8 w-8 text-primary" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">Connect Your Stripe Account</h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
          Securely connect your Stripe account with read-only access to analyze your 
          revenue data and generate AI-powered insights.
        </p>
        <Button
          size="lg"
          className="mt-6 gap-2"
          onClick={onConnect}
          disabled={isConnecting}
        >
          {isConnecting ? (
            <>
              <Spinner size="sm" />
              Connecting...
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4" />
              Connect Stripe
            </>
          )}
        </Button>
        
        {/* Direct API Key Connection (Test Mode Only) */}
        {supportsDirectConnect && onDirectConnect && (
          <div className="mt-4">
            <button
              onClick={() => setShowApiKeyInput(!showApiKeyInput)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
            >
              <Key className="h-3 w-3" />
              Use API Key instead (Test Mode)
              <ChevronDown className={`h-3 w-3 transition-transform ${showApiKeyInput ? 'rotate-180' : ''}`} />
            </button>
            
            <AnimatePresence>
              {showApiKeyInput && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 overflow-hidden"
                >
                  <div className="max-w-md mx-auto space-y-2">
                    <input
                      type="password"
                      placeholder="sk_test_..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono"
                    />
                    {directConnectError && (
                      <p className="text-xs text-red-500">{directConnectError}</p>
                    )}
                    <Button
                      size="sm"
                      onClick={handleDirectConnect}
                      disabled={!apiKey.trim() || isDirectConnecting}
                      className="w-full gap-2"
                    >
                      {isDirectConnecting ? (
                        <>
                          <Spinner size="sm" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <Key className="h-3 w-3" />
                          Connect with API Key
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Paste your Stripe test secret key (starts with sk_test_)
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
        
        <p className="mt-4 text-xs text-muted-foreground">
          We only request read-only access. Your data is encrypted and never shared.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card p-5"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900/30">
            <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">Stripe Connected</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                connection?.livemode 
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
              }`}>
                {connection?.livemode ? 'Live' : 'Test Mode'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Account: {connection?.accountId?.slice(0, 12)}...
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onSync}
            disabled={isSyncing}
            className="gap-1.5"
          >
            {isSyncing ? (
              <>
                <Spinner size="sm" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="h-3.5 w-3.5" />
                Sync Now
              </>
            )}
          </Button>

          {showDisconnect ? (
            <div className="flex items-center gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  onDisconnect();
                  setShowDisconnect(false);
                }}
              >
                Confirm
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDisconnect(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDisconnect(true)}
              className="text-muted-foreground"
            >
              <Unplug className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Sync Status */}
      {connection?.lastSyncAt && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Last synced:</span>
              <span>{getRelativeTime(connection.lastSyncAt)}</span>
            </div>
            {connection.lastSyncStatus === 'failed' && connection.lastSyncError && (
              <div className="flex items-center gap-1.5 text-red-600">
                <AlertCircle className="h-3.5 w-3.5" />
                <span className="text-xs">Sync failed</span>
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}


