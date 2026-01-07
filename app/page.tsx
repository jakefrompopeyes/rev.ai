'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  TrendingUp,
  Shield,
  Zap,
  BarChart3,
  Lightbulb,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

export default function LandingPage() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        router.push('/dashboard');
      } else {
        setIsCheckingAuth(false);
      }
    };
    
    checkUser();
  }, [router]);

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const features = [
    {
      icon: TrendingUp,
      title: 'Revenue Metrics',
      description: 'Track MRR, ARR, ARPU, and churn in real-time with automatic Stripe sync.',
    },
    {
      icon: Lightbulb,
      title: 'AI Insights',
      description: 'Get plain-English explanations of trends, anomalies, and opportunities.',
    },
    {
      icon: Zap,
      title: 'Actionable Recommendations',
      description: 'Receive prioritized actions with estimated revenue impact.',
    },
    {
      icon: Shield,
      title: 'Secure & Read-Only',
      description: 'OAuth connection with read-only access. Your data never leaves your Stripe account.',
    },
    {
      icon: BarChart3,
      title: 'Pricing Intelligence',
      description: 'Detect discount leakage, pricing inefficiencies, and optimization opportunities.',
    },
    {
      icon: RefreshCw,
      title: 'Track Changes',
      description: 'Monitor the impact of your pricing and retention changes over time.',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-lg fixed top-0 inset-x-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary p-2.5">
                <Activity className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold tracking-tight">REV.AI</span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/login">
                <Button variant="ghost" size="sm">Sign In</Button>
              </Link>
              <Link href="/login">
                <Button size="sm" className="gap-1.5">
                  Get Started
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm text-primary mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              AI-Powered Revenue Intelligence
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
              Stop guessing.{' '}
              <span className="gradient-text">Start growing.</span>
            </h1>
            
            <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Connect your Stripe account and get AI-powered insights to reduce churn, 
              optimize pricing, and maximize revenue. Built for subscription businesses.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/login">
                <Button size="lg" className="gap-2 text-base px-8">
                  Start Free Analysis
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <p className="text-sm text-muted-foreground">
                No credit card required • Read-only access
              </p>
            </div>
          </motion.div>

          {/* Preview */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-16 rounded-2xl border border-border bg-card shadow-2xl shadow-primary/5 overflow-hidden"
          >
            <div className="p-1.5 bg-muted/50 border-b border-border flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
              <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
            </div>
            <div className="p-8 space-y-6">
              {/* Mock metrics */}
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'MRR', value: '$47,250', change: '+12.4%' },
                  { label: 'Active', value: '1,247', change: '+8.2%' },
                  { label: 'ARPU', value: '$38', change: '+4.1%' },
                  { label: 'Churn', value: '2.3%', change: '-0.8%' },
                ].map((metric, i) => (
                  <motion.div
                    key={metric.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + i * 0.1 }}
                    className="rounded-lg border border-border bg-background p-4 text-left"
                  >
                    <div className="text-xs text-muted-foreground">{metric.label}</div>
                    <div className="text-xl font-bold mt-1">{metric.value}</div>
                    <div className={`text-xs mt-1 ${
                      metric.change.startsWith('+') ? 'text-emerald-600' : 'text-amber-600'
                    }`}>
                      {metric.change}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Mock insight */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.9 }}
                className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-left dark:border-amber-900 dark:bg-amber-950/30"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-amber-100 p-2 dark:bg-amber-900/50">
                    <Lightbulb className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-amber-800 dark:text-amber-200">
                      Customers on Basic plan churn 2.3x faster
                    </div>
                    <p className="text-xs text-amber-700/80 dark:text-amber-300/70 mt-1">
                      Consider adding more value to Basic or creating a migration path to Pro.
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight">
              Everything you need to grow revenue
            </h2>
            <p className="mt-3 text-muted-foreground">
              Connect once, get insights forever. No manual data entry required.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="rounded-xl border border-border bg-card p-6 card-hover"
              >
                <div className="rounded-lg bg-primary/10 p-3 w-fit">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-4 font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto text-center rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-violet-600 p-12 text-white relative overflow-hidden"
        >
          <div className="absolute inset-0 grid-bg opacity-10" />
          <div className="relative z-10">
            <h2 className="text-3xl font-bold">Ready to unlock revenue insights?</h2>
            <p className="mt-4 text-white/80 max-w-lg mx-auto">
              Join subscription businesses using AI to make smarter pricing and retention decisions.
            </p>
            <Link href="/login">
              <Button
                size="lg"
                className="mt-8 bg-white text-primary hover:bg-white/90 gap-2"
              >
                Get Started Free
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            <span>REV.AI</span>
          </div>
          <div>© 2024 REV.AI. Built for subscription businesses.</div>
        </div>
      </footer>
    </div>
  );
}

