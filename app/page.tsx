'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
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
  AlertCircle,
  FileSpreadsheet,
  HelpCircle,
  XCircle,
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
              <div className="relative h-9 w-9">
                <Image
                  src="/logo.png"
                  alt="discovred logo"
                  fill
                  className="object-contain"
                />
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
              
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.2] mb-6">
                Stop guessing.{' '}
                <span className="gradient-text block mt-2 pb-0.5">Start growing.</span>
              </h1>
              
              <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed mb-4 max-w-xl">
                Are you losing revenue to hidden discount leakage? Struggling to know if a price increase is safe? 
                Spending hours in spreadsheets trying to understand why customers churn?
              </p>
              <p className="text-lg sm:text-xl text-foreground font-medium leading-relaxed mb-8 max-w-xl">
                discovred transforms your Stripe data into actionable revenue intelligence. Get instant insights on 
                churn patterns, discount leakage, legacy pricing, and price-change safety—all without the spreadsheet headaches.
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

      {/* Problems We Solve */}
      <section className="py-24 px-6 bg-muted/30 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
              The problems we solve
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              B2B SaaS teams face these revenue challenges every day. We help you solve them with data, not guesswork.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: DollarSign,
                title: 'Hidden Revenue Leakage',
                problem: 'You\'re giving discounts to customers who would pay full price, but you don\'t know which ones.',
                solution: 'We identify unnecessary discounts and show you exactly how much revenue you\'re leaving on the table.',
                iconBg: 'bg-red-500/10',
                iconColor: 'text-red-600 dark:text-red-400',
              },
              {
                icon: TrendingDown,
                title: 'Mystery Churn',
                problem: 'Customers are churning and you\'re not sure why. Is it pricing? Plan value? Payment issues?',
                solution: 'AI-powered insights reveal churn patterns by plan, segment, and behavior so you can fix what\'s broken.',
                iconBg: 'bg-orange-500/10',
                iconColor: 'text-orange-600 dark:text-orange-400',
              },
              {
                icon: History,
                title: 'Legacy Pricing Creep',
                problem: 'Old customers are paying outdated rates, but you\'re afraid to raise prices and risk churn.',
                solution: 'We analyze your historical price increases to show you safe thresholds and identify customers ready for updates.',
                iconBg: 'bg-purple-500/10',
                iconColor: 'text-purple-600 dark:text-purple-400',
              },
              {
                icon: FileSpreadsheet,
                title: 'Spreadsheet Hell',
                problem: 'You spend hours exporting Stripe data, building pivot tables, and trying to spot trends manually.',
                solution: 'Automated sync and AI analysis mean insights are ready in minutes, not days. No spreadsheets required.',
                iconBg: 'bg-blue-500/10',
                iconColor: 'text-blue-600 dark:text-blue-400',
              },
              {
                icon: HelpCircle,
                title: 'Pricing Decisions in the Dark',
                problem: 'You want to test new pricing or convert monthly to annual, but you don\'t know the impact or risk.',
                solution: 'Get data-driven recommendations with revenue impact estimates and risk assessments before you make changes.',
                iconBg: 'bg-emerald-500/10',
                iconColor: 'text-emerald-600 dark:text-emerald-400',
              },
              {
                icon: AlertCircle,
                title: 'Reactive Problem Solving',
                problem: 'You only discover revenue issues after they\'ve already cost you money and customers.',
                solution: 'Proactive alerts and insights catch problems early, so you can fix them before they impact your bottom line.',
                iconBg: 'bg-amber-500/10',
                iconColor: 'text-amber-600 dark:text-amber-400',
              },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="rounded-2xl border border-border bg-card p-6 shadow-lg"
              >
                <div className={`rounded-lg ${item.iconBg} p-3 w-fit mb-4`}>
                  <item.icon className={`h-6 w-6 ${item.iconColor}`} />
                </div>
                <h3 className="font-semibold text-xl mb-3">{item.title}</h3>
                <div className="space-y-3">
                  <div>
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">The Problem</div>
                    <p className="text-sm text-muted-foreground">{item.problem}</p>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-primary uppercase tracking-wide mb-1.5">How We Help</div>
                    <p className="text-sm text-foreground">{item.solution}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* CTA in problems section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="mt-12 text-center"
          >
            <Link href={freeReportHref}>
              <Button size="lg" className="gap-2 text-base px-8">
                See your revenue opportunities
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <p className="text-sm text-muted-foreground mt-4">
              Get a free report in minutes • No credit card required
            </p>
          </motion.div>
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
          <div className="text-center mb-12">
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
              Everything you need to grow revenue
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Stop wrestling with spreadsheets. Get instant, actionable insights from your Stripe data.
            </p>
          </div>
          
          <div className="space-y-6">
            {[
              { icon: TrendingUp, title: 'Real-Time Revenue Metrics', desc: 'Track MRR, ARR, ARPU, and churn in real-time with automatic Stripe sync. No manual exports or calculations.' },
              { icon: Lightbulb, title: 'AI-Powered Insights', desc: 'Get plain-English explanations of trends, anomalies, and revenue opportunities. Understand the "why" behind your numbers.' },
              { icon: Zap, title: 'Actionable Recommendations', desc: 'Receive prioritized actions with estimated revenue impact. Know exactly what to do next and how much it\'s worth.' },
              { icon: BarChart3, title: 'Pricing Intelligence', desc: 'Detect discount leakage, legacy plans, and price-change opportunities before they hurt retention. Make safer pricing decisions.' },
              { icon: Shield, title: 'Secure & Read-Only', desc: 'OAuth connection with read-only access. Your data never leaves your Stripe account. We can\'t modify anything.' },
              { icon: RefreshCw, title: 'Track Your Impact', desc: 'Monitor the impact of your pricing and retention changes over time. See what\'s working and what isn\'t.' },
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

          {/* CTA in features section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="mt-12 text-center pt-12 border-t border-border"
          >
            <Link href={freeReportHref}>
              <Button size="lg" variant="default" className="gap-2 text-base px-8">
                Get started with a free report
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6 relative z-10">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="rounded-3xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5 p-12 text-center shadow-2xl"
          >
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
              Stop leaving revenue on the table
            </h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Connect your Stripe account and get instant insights on discount leakage, churn patterns, 
              legacy pricing, and price-change opportunities. All in minutes, not days.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
              <Link href={freeReportHref}>
                <Button size="lg" className="gap-2 text-base px-8 h-12 text-lg">
                  Generate your free report
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Read-only Stripe access</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Best for $1M–$15M ARR</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-6 relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="relative h-4 w-4">
              <Image
                src="/logo.png"
                alt="discovred logo"
                fill
                className="object-contain"
              />
            </div>
            <span>discovred</span>
          </div>
          <div>© 2024 discovred. Built for B2B SaaS on Stripe Billing.</div>
        </div>
      </footer>
    </div>
  );
}
