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
  CheckCircle2,
  ArrowUpRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { AnimatedBackground } from '@/components/ui/animated-background';

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

  return (
    <div className="min-h-screen relative">
      <AnimatedBackground />
      
      {/* Navigation */}
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-lg fixed top-0 inset-x-0 z-50 relative">
        <div className="max-w-7xl mx-auto px-6 py-4">
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

      {/* Hero - Asymmetric Layout */}
      <section className="pt-32 pb-24 px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Content */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm text-primary mb-6">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                Revenue Intelligence for Stripe
              </div>
              
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
                Stop guessing.{' '}
                <span className="gradient-text block mt-2">Start growing.</span>
              </h1>
              
              <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed mb-8 max-w-xl">
                Built for B2B SaaS on Stripe Billing. Connect Stripe and get actionable insights to reduce churn,
                find discount leakage, and make safer pricing changes.
              </p>

              <div className="flex flex-col sm:flex-row items-start gap-4 mb-8">
                <Link href={freeReportHref}>
                  <Button size="lg" className="gap-2 text-base px-8">
                    Generate free Stripe report
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <div className="text-sm text-muted-foreground pt-2">
                  <div>Best for ~$1M–$15M ARR</div>
                  <div>No credit card • Read-only access</div>
                </div>
              </div>

              {/* Quick stats inline */}
              <div className="flex flex-wrap gap-6 pt-6 border-t border-border">
                <div>
                  <div className="text-2xl font-bold">127</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mt-1">Annual Opportunities</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">$48K+</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mt-1">Recoverable Revenue</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">43</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mt-1">Legacy Plans Found</div>
                </div>
              </div>
            </motion.div>

            {/* Right: Preview Dashboard */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="rounded-2xl border border-border bg-card shadow-2xl shadow-primary/5 overflow-hidden">
                <div className="p-1.5 bg-muted/50 border-b border-border flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                  <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
                </div>
                <div className="p-8 space-y-6">
                  {/* Metrics */}
                  <div className="grid grid-cols-2 gap-4">
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
                        className="rounded-xl border border-border bg-card p-4"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="rounded-lg bg-primary/10 p-2">
                            <metric.icon className="h-4 w-4 text-primary" />
                          </div>
                          <div className={`text-xs font-medium ${
                            metric.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                          }`}>
                            {metric.change}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{metric.label}</div>
                        <div className="text-xl font-bold">{metric.value}</div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Insight */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.9 }}
                    className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30"
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
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Pricing Intelligence - Staggered Layout */}
      <section className="py-24 px-6 bg-transparent relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
              Pricing Intelligence
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl">
              Discover revenue opportunities hidden in your Stripe data. No spreadsheets, no guesswork.
            </p>
          </div>

          {/* Staggered grid layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Large card - spans 2 columns */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="lg:col-span-2 rounded-2xl border border-border bg-card p-8 shadow-lg"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-emerald-500/10 p-3">
                    <Calendar className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-xl">Annual Plan Opportunity</h3>
                    <p className="text-sm text-muted-foreground mt-1">Convert monthly to annual</p>
                  </div>
                </div>
                <ArrowUpRight className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="text-4xl font-bold text-foreground mb-2">127</div>
                  <div className="text-sm text-muted-foreground">monthly subscribers ready for annual</div>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
                  <div className="text-sm font-medium text-emerald-800 dark:text-emerald-200 mb-1">
                    +$48,200/year
                  </div>
                  <div className="text-xs text-emerald-700/80 dark:text-emerald-300/70">
                    Cash flow gain with 10% discount
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Small card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="rounded-2xl border border-border bg-card p-8 shadow-lg"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="rounded-lg bg-purple-500/10 p-3">
                  <History className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Legacy Pricing</h3>
                  <p className="text-xs text-muted-foreground mt-1">Detection</p>
                </div>
              </div>
              <div className="text-3xl font-bold text-foreground mb-2">43</div>
              <div className="text-sm text-muted-foreground mb-4">customers paying 18% below current rates</div>
              <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 dark:border-purple-900 dark:bg-purple-950/30">
                <div className="text-sm font-medium text-purple-800 dark:text-purple-200">
                  $62,400/year recoverable
                </div>
              </div>
            </motion.div>

            {/* Medium card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="rounded-2xl border border-border bg-card p-8 shadow-lg"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="rounded-lg bg-emerald-500/10 p-3">
                  <ShieldCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Price Increase Safety</h3>
                  <p className="text-xs text-muted-foreground mt-1">Risk analysis</p>
                </div>
              </div>
              <div className="text-3xl font-bold text-foreground mb-2">87%</div>
              <div className="text-sm text-muted-foreground mb-4">retention after past increases</div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                <div className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                  Safe to increase up to 15%
                </div>
              </div>
            </motion.div>

            {/* Medium card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="lg:col-span-2 rounded-2xl border border-border bg-card p-8 shadow-lg"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-red-500/10 p-3">
                    <Tag className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-xl">Discount Analysis</h3>
                    <p className="text-sm text-muted-foreground mt-1">Find unnecessary discounts</p>
                  </div>
                </div>
                <ArrowUpRight className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="text-4xl font-bold text-foreground mb-2">34%</div>
                  <div className="text-sm text-muted-foreground">of discounts were unnecessary</div>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
                  <div className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                    $28,500/year recoverable
                  </div>
                  <div className="text-xs text-red-700/80 dark:text-red-300/70">
                    89 customers paid full price later
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* What You Get - Simple List */}
      <section className="py-24 px-6 bg-transparent relative z-10">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-12">
            What you get
          </h2>
          
          <div className="space-y-6">
            {[
              { icon: TrendingUp, title: 'Revenue Metrics', desc: 'Track MRR, ARR, ARPU, and churn in real-time with automatic Stripe sync.' },
              { icon: Lightbulb, title: 'Smart Insights', desc: 'Get clear explanations of trends, anomalies, and revenue opportunities.' },
              { icon: Zap, title: 'Actionable Recommendations', desc: 'Receive prioritized actions with estimated revenue impact.' },
              { icon: BarChart3, title: 'Pricing Intelligence', desc: 'Detect discount leakage, legacy plans, and price-change opportunities before they hurt retention.' },
              { icon: Shield, title: 'Secure & Read-Only', desc: 'OAuth connection with read-only access. Your data never leaves your Stripe account.' },
              { icon: RefreshCw, title: 'Track Changes', desc: 'Monitor the impact of your pricing and retention changes over time.' },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex gap-4 items-start"
              >
                <div className="rounded-lg bg-primary/10 p-2.5 mt-0.5 flex-shrink-0">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">{item.title}</h3>
                  <p className="text-muted-foreground">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Simple CTA */}
      <section className="py-24 px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
            Ready to unlock revenue insights?
          </h2>
          <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
            Join B2B SaaS teams making smarter pricing and retention decisions with data-driven insights.
          </p>
          <Link href={freeReportHref}>
            <Button size="lg" className="gap-2 text-base px-8">
              Generate free report
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-6 relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
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
