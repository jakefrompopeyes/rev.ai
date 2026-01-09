'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  User,
  Palette,
  Bell,
  Shield,
  CreditCard,
  LogOut,
  Moon,
  Sun,
  Monitor,
  ChevronRight,
  Check,
  Zap,
  Mail,
  Building,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  user: SupabaseUser | null;
  onSignOut: () => Promise<void>;
}

type Theme = 'light' | 'dark' | 'system';

export function SettingsPanel({ isOpen, onClose, user, onSignOut }: SettingsPanelProps) {
  const [activeSection, setActiveSection] = useState<string>('profile');
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved === 'dark' || saved === 'light') return saved;
    }
    return 'system';
  });

  const handleThemeChange = (theme: Theme) => {
    setCurrentTheme(theme);
    const root = document.documentElement;
    
    if (theme === 'system') {
      localStorage.removeItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    } else {
      localStorage.setItem('theme', theme);
      root.classList.toggle('dark', theme === 'dark');
    }
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await onSignOut();
    setIsSigningOut(false);
  };

  const sections = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  const themeOptions: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ];

  const userName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';
  const userInitial = userName[0]?.toUpperCase() || 'U';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-background border-l border-border shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-card/50">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary via-violet-500 to-fuchsia-500 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                  {userInitial}
                </div>
                <div>
                  <h2 className="font-semibold text-lg">{userName}</h2>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="h-9 w-9 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 flex overflow-hidden">
              {/* Navigation sidebar */}
              <nav className="w-48 border-r border-border bg-muted/30 p-3 flex flex-col gap-1">
                {sections.map((section) => {
                  const Icon = section.icon;
                  const isActive = activeSection === section.id;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-md'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {section.label}
                    </button>
                  );
                })}
              </nav>

              {/* Section content */}
              <div className="flex-1 p-6 overflow-y-auto">
                <AnimatePresence mode="wait">
                  {activeSection === 'profile' && (
                    <motion.div
                      key="profile"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-6"
                    >
                      <div>
                        <h3 className="text-lg font-semibold mb-4">Profile Settings</h3>
                        
                        {/* Profile card */}
                        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
                          <div className="flex items-center gap-4">
                            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary via-violet-500 to-fuchsia-500 flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                              {userInitial}
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-lg">{userName}</p>
                              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                                <Mail className="h-3.5 w-3.5" />
                                {user?.email}
                              </p>
                            </div>
                          </div>
                          
                          <div className="pt-4 border-t border-border space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground flex items-center gap-2">
                                <Building className="h-4 w-4" />
                                Organization
                              </span>
                              <span className="text-sm font-medium">Personal</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground flex items-center gap-2">
                                <Zap className="h-4 w-4" />
                                Plan
                              </span>
                              <span className="inline-flex items-center gap-1 text-sm font-medium bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
                                Pro
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Quick actions */}
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-3">Quick Actions</h4>
                        <div className="space-y-2">
                          <button className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors group">
                            <span className="text-sm font-medium">Edit Profile</span>
                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                          </button>
                          <button className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors group">
                            <span className="text-sm font-medium">Manage Team</span>
                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeSection === 'appearance' && (
                    <motion.div
                      key="appearance"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-6"
                    >
                      <div>
                        <h3 className="text-lg font-semibold mb-1">Appearance</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Customize how REV.AI looks on your device.
                        </p>
                        
                        {/* Theme selection */}
                        <div className="rounded-xl border border-border bg-card p-4">
                          <p className="text-sm font-medium mb-3">Theme</p>
                          <div className="grid grid-cols-3 gap-3">
                            {themeOptions.map((option) => {
                              const Icon = option.icon;
                              const isSelected = currentTheme === option.value;
                              return (
                                <button
                                  key={option.value}
                                  onClick={() => handleThemeChange(option.value)}
                                  className={cn(
                                    'relative flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
                                    isSelected
                                      ? 'border-primary bg-primary/5'
                                      : 'border-border hover:border-muted-foreground/50'
                                  )}
                                >
                                  <Icon className={cn('h-6 w-6', isSelected ? 'text-primary' : 'text-muted-foreground')} />
                                  <span className={cn('text-sm font-medium', isSelected ? 'text-primary' : 'text-muted-foreground')}>
                                    {option.label}
                                  </span>
                                  {isSelected && (
                                    <motion.div
                                      layoutId="theme-check"
                                      className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-primary flex items-center justify-center"
                                    >
                                      <Check className="h-3 w-3 text-primary-foreground" />
                                    </motion.div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Preview */}
                      <div className="rounded-xl border border-border overflow-hidden">
                        <div className="px-4 py-3 bg-muted/50 border-b border-border">
                          <p className="text-sm font-medium">Preview</p>
                        </div>
                        <div className="p-4 space-y-3">
                          <div className="h-3 w-3/4 rounded bg-muted animate-pulse" />
                          <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
                          <div className="flex gap-2 mt-4">
                            <div className="h-8 w-20 rounded bg-primary/20" />
                            <div className="h-8 w-20 rounded bg-muted" />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeSection === 'notifications' && (
                    <motion.div
                      key="notifications"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-6"
                    >
                      <div>
                        <h3 className="text-lg font-semibold mb-1">Notifications</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Manage how you receive alerts and updates.
                        </p>
                        
                        <div className="space-y-3">
                          {[
                            { label: 'Revenue alerts', description: 'Get notified about significant revenue changes', enabled: true },
                            { label: 'Churn risk alerts', description: 'Alerts when customers show churn signals', enabled: true },
                            { label: 'Payment failures', description: 'Notify when payments fail', enabled: true },
                            { label: 'Weekly digest', description: 'Weekly summary of your metrics', enabled: false },
                            { label: 'New insights', description: 'AI-generated insights notifications', enabled: true },
                          ].map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-card">
                              <div>
                                <p className="text-sm font-medium">{item.label}</p>
                                <p className="text-xs text-muted-foreground">{item.description}</p>
                              </div>
                              <button
                                className={cn(
                                  'relative h-6 w-11 rounded-full transition-colors',
                                  item.enabled ? 'bg-primary' : 'bg-muted'
                                )}
                              >
                                <span
                                  className={cn(
                                    'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
                                    item.enabled ? 'translate-x-5' : 'translate-x-0.5'
                                  )}
                                />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeSection === 'billing' && (
                    <motion.div
                      key="billing"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-6"
                    >
                      <div>
                        <h3 className="text-lg font-semibold mb-1">Billing</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Manage your subscription and payment methods.
                        </p>
                        
                        {/* Current plan */}
                        <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 to-violet-500/5 p-6 mb-4">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <p className="text-sm text-muted-foreground">Current Plan</p>
                              <p className="text-2xl font-bold bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
                                Pro Plan
                              </p>
                            </div>
                            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center">
                              <Zap className="h-6 w-6 text-white" />
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mb-4">
                            $49/month • Renews on Feb 8, 2026
                          </p>
                          <div className="flex gap-2">
                            <button className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                              Upgrade Plan
                            </button>
                            <button className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">
                              Manage Billing
                            </button>
                          </div>
                        </div>

                        {/* Payment method */}
                        <div className="rounded-xl border border-border bg-card p-4">
                          <p className="text-sm font-medium mb-3">Payment Method</p>
                          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                            <div className="h-10 w-14 rounded bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white text-xs font-bold">
                              VISA
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium">•••• •••• •••• 4242</p>
                              <p className="text-xs text-muted-foreground">Expires 12/28</p>
                            </div>
                            <button className="text-sm text-primary hover:underline">Edit</button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeSection === 'security' && (
                    <motion.div
                      key="security"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-6"
                    >
                      <div>
                        <h3 className="text-lg font-semibold mb-1">Security</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Manage your account security settings.
                        </p>
                        
                        <div className="space-y-3">
                          <button className="w-full flex items-center justify-between px-4 py-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors group">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                                <Shield className="h-5 w-5 text-muted-foreground" />
                              </div>
                              <div className="text-left">
                                <p className="text-sm font-medium">Two-Factor Authentication</p>
                                <p className="text-xs text-muted-foreground">Add an extra layer of security</p>
                              </div>
                            </div>
                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-500/10 text-amber-600">
                              Not enabled
                            </span>
                          </button>

                          <button className="w-full flex items-center justify-between px-4 py-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors group">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                                <Mail className="h-5 w-5 text-muted-foreground" />
                              </div>
                              <div className="text-left">
                                <p className="text-sm font-medium">Change Password</p>
                                <p className="text-xs text-muted-foreground">Update your account password</p>
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                          </button>

                          <button className="w-full flex items-center justify-between px-4 py-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors group">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                                <User className="h-5 w-5 text-muted-foreground" />
                              </div>
                              <div className="text-left">
                                <p className="text-sm font-medium">Active Sessions</p>
                                <p className="text-xs text-muted-foreground">Manage your active sessions</p>
                              </div>
                            </div>
                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600">
                              1 active
                            </span>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Footer with sign out */}
            <div className="border-t border-border bg-card/50 p-4">
              <button
                onClick={handleSignOut}
                disabled={isSigningOut}
                className={cn(
                  'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg',
                  'bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground',
                  'font-medium transition-all',
                  isSigningOut && 'opacity-50 cursor-not-allowed'
                )}
              >
                <LogOut className="h-4 w-4" />
                {isSigningOut ? 'Signing out...' : 'Sign Out'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

