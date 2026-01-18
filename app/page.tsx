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
  DollarSign,
  Users,
  Target,
  TrendingDown,
  Calendar,
  History,
  ShieldCheck,
  Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

export default function LandingPage() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const freeReportHref = `/login?redirect=${encodeURIComponent('/dashboard?flow=free-report')}`;

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
      description: 'Detect discount leakage, legacy plans, and price-change opportunities before they hurt retention.',
    },
    {
      icon: RefreshCw,
      title: 'Track Changes',
      description: 'Monitor the impact of your pricing and retention changes over time.',
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-lg fixed top-0 inset-x-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary p-2.5">
                <Activity className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold tracking-tight">discovred</span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/pricing">
                <Button variant="ghost" size="sm">Pricing</Button>
              </Link>
              <Link href="/login">
                <Button variant="ghost" size="sm">Sign In</Button>
              </Link>
              <Link href={freeReportHref}>
                <Button size="sm" className="gap-1.5">
                  Free report
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
              Built for B2B SaaS on Stripe Billing. Connect Stripe and get AI-powered insights to reduce churn,
              find discount leakage, and make safer pricing changes.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href={freeReportHref}>
                <Button size="lg" className="gap-2 text-base px-8">
                  Generate free Stripe report
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <p className="text-sm text-muted-foreground">
                Best for ~$1M–$15M ARR • No credit card required • Read-only access
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
              {/* Preview metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
                {[
                  { icon: DollarSign, label: 'MRR', value: '$47,250', change: '+12.4%', positive: true },
                  { icon: Users, label: 'Active', value: '1,247', change: '+8.2%', positive: true },
                  { icon: Target, label: 'ARPU', value: '$38', change: '+4.1%', positive: true },
                  { icon: TrendingDown, label: 'Churn', value: '2.3%', change: '-0.8%', positive: true },
                ].map((metric, i) => (
                  <motion.div
                    key={metric.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + i * 0.1 }}
                    className="rounded-xl border border-border bg-card p-5"
                  >
                    <div className="rounded-lg bg-primary/10 p-3 w-fit">
                      <metric.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="mt-4 text-xs text-muted-foreground uppercase tracking-wide">{metric.label}</div>
                    <div className="text-2xl font-bold mt-1">{metric.value}</div>
                    <div className={`text-sm font-medium mt-1 ${
                      metric.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {metric.change}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Preview insight */}
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

      {/* Feature Previews */}
      <section className="py-20 px-6 bg-transparent">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight">
              AI-Powered Pricing Intelligence
            </h2>
            <p className="mt-3 text-muted-foreground">
              Discover revenue opportunities hidden in your Stripe data
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Annual Plan Opportunity Preview */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="rounded-2xl border border-border bg-card shadow-xl shadow-primary/5 overflow-hidden"
            >
              <div className="p-1.5 bg-muted/50 border-b border-border flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-emerald-500/10 p-2">
                    <Calendar className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h3 className="font-semibold text-lg">Annual Plan Opportunity</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="text-3xl font-bold text-foreground">127</div>
                    <div className="text-sm text-muted-foreground">monthly subscribers ready for annual</div>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                    <div className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                      +$48,200/year cash flow gain
                    </div>
                    <div className="text-xs text-emerald-700/80 dark:text-emerald-300/70 mt-1">
                      With 10% annual discount, ~25% expected conversion
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Legacy Pricing Detection Preview */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="rounded-2xl border border-border bg-card shadow-xl shadow-primary/5 overflow-hidden"
            >
              <div className="p-1.5 bg-muted/50 border-b border-border flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-purple-500/10 p-2">
                    <History className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="font-semibold text-lg">Legacy Pricing Detection</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="text-3xl font-bold text-foreground">43 customers</div>
                    <div className="text-sm text-muted-foreground">paying 18% below current rates</div>
                  </div>
                  <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 dark:border-purple-900 dark:bg-purple-950/30">
                    <div className="text-sm font-medium text-purple-800 dark:text-purple-200">
                      $62,400/year recoverable
                    </div>
                    <div className="text-xs text-purple-700/80 dark:text-purple-300/70 mt-1">
                      Legacy customers churn 2.1% less—safe to migrate
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Price Increase Safety Preview */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="rounded-2xl border border-border bg-card shadow-xl shadow-primary/5 overflow-hidden"
            >
              <div className="p-1.5 bg-muted/50 border-b border-border flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-emerald-500/10 p-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h3 className="font-semibold text-lg">Price Increase Safety</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="text-3xl font-bold text-foreground">87%</div>
                    <div className="text-sm text-muted-foreground">retention after past increases</div>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                    <div className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                      Safe to increase up to 15%
                    </div>
                    <div className="text-xs text-emerald-700/80 dark:text-emerald-300/70 mt-1">
                      Based on 23 price increases affecting 156 customers
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Discount Analysis Preview */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="rounded-2xl border border-border bg-card shadow-xl shadow-primary/5 overflow-hidden"
            >
              <div className="p-1.5 bg-muted/50 border-b border-border flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-red-500/10 p-2">
                    <Tag className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <h3 className="font-semibold text-lg">Discount Analysis</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="text-3xl font-bold text-foreground">34%</div>
                    <div className="text-sm text-muted-foreground">of discounts were unnecessary</div>
                  </div>
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30">
                    <div className="text-sm font-medium text-red-800 dark:text-red-200">
                      $28,500/year recoverable
                    </div>
                    <div className="text-xs text-red-700/80 dark:text-red-300/70 mt-1">
                      89 customers paid full price later or upgraded
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-transparent">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight">
                  Everything you need to improve pricing + retention
            </h2>
            <p className="mt-3 text-muted-foreground">
                  Connect once, get answers fast. No manual data entry required.
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
              Join B2B SaaS teams using AI to make smarter pricing and retention decisions.
            </p>
            <Link href={freeReportHref}>
              <Button
                size="lg"
                className="mt-8 bg-white text-primary hover:bg-white/90 gap-2"
              >
                Generate free report
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
            <span>discovred</span>
          </div>
          <div>© 2024 discovred. Built for B2B SaaS on Stripe Billing.</div>
        </div>
      </footer>
    </div>
  );
}

