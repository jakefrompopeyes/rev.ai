'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Activity, ArrowRight, BarChart3, CreditCard, Lightbulb, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

export default function FreeReportPage() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const redirectTo = useMemo(() => '/dashboard?flow=free-report', []);
  const loginHref = useMemo(() => `/login?redirect=${encodeURIComponent(redirectTo)}`, [redirectTo]);

  useEffect(() => {
    const supabase = createClient();
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        router.push(redirectTo);
      } else {
        setIsCheckingAuth(false);
      }
    };
    checkUser();
  }, [router, redirectTo]);

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-lg fixed top-0 inset-x-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="rounded-xl bg-primary p-2.5">
                <Activity className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold tracking-tight">discovred</span>
            </Link>
            <div className="flex items-center gap-3">
              <Link href="/pricing">
                <Button variant="ghost" size="sm">
                  Pricing
                </Button>
              </Link>
              <Link href={loginHref}>
                <Button variant="outline" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link href={loginHref}>
                <Button size="sm" className="gap-1.5">
                  Generate report
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <section className="pt-32 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm text-primary mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Free Stripe Pricing Opportunity Report
            </div>

            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
              Connect Stripe. Get your first pricing opportunities in minutes.
            </h1>

            <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Built for subscription businesses on Stripe Billing. We generate a plain-English report highlighting discount
              leakage, plan risks, and safer pricing moves.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href={loginHref}>
                <Button size="lg" className="gap-2 text-base px-8">
                  Generate free report
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <p className="text-sm text-muted-foreground">
                No credit card • Read-only access • Works with Stripe subscriptions
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 36 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left"
          >
            {[
              {
                icon: CreditCard,
                title: '1) Connect Stripe',
                desc: 'OAuth read-only. No engineering required.',
              },
              {
                icon: Lightbulb,
                title: '2) Get opportunities',
                desc: 'Discount leakage, annual plan candidates, plan risk signals.',
              },
              {
                icon: BarChart3,
                title: '3) Take action',
                desc: 'Track changes over time and share results with your team.',
              },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-border bg-card p-5">
                <div className="rounded-lg bg-primary/10 p-3 w-fit">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-4 font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="mt-10 inline-flex items-center gap-2 text-xs text-muted-foreground"
          >
            <Shield className="h-3.5 w-3.5" />
            Stripe access is read-only. You can disconnect anytime.
          </motion.div>
        </div>
      </section>
    </div>
  );
}


