'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Check,
  Sparkles,
  Zap,
  Shield,
  BarChart3,
  Users,
  Building2,
  Crown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { BillingInterval } from '@/lib/billing/tiers';
import { getBillingTiers } from '@/lib/billing/tiers';

type PricingTier = ReturnType<typeof getBillingTiers>[number] & { icon: React.ElementType };

const faqs = [
  {
    question: 'How does the free trial work?',
    answer:
      'All paid plans come with a 14-day free trial. No credit card required to start. You\'ll get full access to all features in your selected plan during the trial.',
  },
  {
    question: 'Can I change plans later?',
    answer:
      'Absolutely! You can upgrade, downgrade, or cancel your plan at any time. When you upgrade, you\'ll be prorated for the remaining time. When you downgrade, the change takes effect at your next billing cycle.',
  },
  {
    question: 'What happens if I exceed my MRR limit?',
    answer:
      'We\'ll notify you when you\'re approaching your plan\'s MRR limit. You can upgrade at any time to continue tracking all your revenue. We never stop syncing your data—we just encourage an upgrade.',
  },
  {
    question: 'Is my Stripe data secure?',
    answer:
      'Yes. We use Stripe OAuth with read-only access. We sync only what we need to compute metrics and generate insights, and we keep sensitive data handling to a minimum.',
  },
  {
    question: 'Do you offer discounts for annual billing?',
    answer:
      'Yes! Save 20% when you choose annual billing. The discount is automatically applied when you select the annual option.',
  },
];

export default function PricingPage() {
  const [interval, setInterval] = useState<BillingInterval>('monthly');

  const tiers: PricingTier[] = useMemo(() => {
    const base = getBillingTiers();
    const iconFor = (key: string) => {
      switch (key) {
        case 'starter':
          return Zap;
        case 'growth':
          return BarChart3;
        case 'scale':
          return Users;
        case 'enterprise':
          return Building2;
        default:
          return Zap;
      }
    };
    return base.map((t) => ({ ...t, icon: iconFor(t.key) }));
  }, []);

  const handleCheckout = async (tier: PricingTier) => {
    if (tier.monthlyPriceUsd === -1) {
      // Enterprise - redirect to contact
      window.location.href = 'mailto:sales@rev.ai?subject=Enterprise%20Inquiry';
      return;
    }

    if (tier.monthlyPriceUsd === 0) {
      // Free tier - redirect to signup
      window.location.href = '/login';
      return;
    }

    // Paid tier - create checkout session
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tierKey: tier.key,
          interval,
        }),
      });

      const { url, error } = await response.json();
      if (url) {
        window.location.href = url;
      } else if (error) {
        console.error('Checkout error:', error);
      }
    } catch (error) {
      console.error('Checkout error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-lg fixed top-0 inset-x-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="relative h-9 w-9">
                <Image
                  src="/logo.png"
                  alt="discovred logo"
                  fill
                  className="object-contain"
                />
              </div>
              <span className="text-xl font-bold tracking-tight">discovred</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
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
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm text-primary mb-6">
              <Crown className="h-3.5 w-3.5" />
              Simple, transparent pricing
            </div>

            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
              Start free, scale as you{' '}
              <span className="gradient-text">grow</span>
            </h1>

            <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Designed for B2B SaaS on Stripe Billing—especially teams planning price changes
              or dealing with discounting. All paid plans include a 14-day free trial.
            </p>
          </motion.div>

          {/* Billing Toggle */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-10 flex items-center justify-center gap-4"
          >
            <button
              onClick={() => setInterval('monthly')}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                interval === 'monthly'
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setInterval('annually')}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
                interval === 'annually'
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Annually
              <span className="text-xs bg-success text-success-foreground px-2 py-0.5 rounded-full">
                Save 20%
              </span>
            </button>
          </motion.div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {tiers.map((tier, i) => (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 * i }}
                className={cn(
                  'relative rounded-2xl border bg-card p-6 flex flex-col',
                  tier.highlight
                    ? 'border-primary shadow-xl shadow-primary/10 scale-[1.02]'
                    : 'border-border'
                )}
              >
                {tier.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full shadow-lg">
                      <Sparkles className="h-3 w-3" />
                      {tier.badge}
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <div
                    className={cn(
                      'rounded-xl p-3 w-fit',
                      tier.highlight ? 'bg-primary/20' : 'bg-muted'
                    )}
                  >
                    <tier.icon
                      className={cn(
                        'h-6 w-6',
                        tier.highlight ? 'text-primary' : 'text-muted-foreground'
                      )}
                    />
                  </div>
                  <h3 className="mt-4 text-xl font-bold">{tier.name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {tier.description}
                  </p>
                </div>

                <div className="mb-6">
                  {tier.monthlyPriceUsd === -1 ? (
                    <div className="text-3xl font-bold">Custom</div>
                  ) : tier.monthlyPriceUsd === 0 ? (
                    <div className="text-3xl font-bold">Free</div>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold">
                        $
                        {interval === 'monthly'
                          ? tier.monthlyPriceUsd
                          : tier.annualPriceUsd}
                      </span>
                      <span className="text-muted-foreground">/mo</span>
                    </div>
                  )}
                  {tier.monthlyPriceUsd > 0 && interval === 'annually' && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Billed annually (${tier.annualPriceUsd * 12}/year)
                    </p>
                  )}
                </div>

                <Button
                  onClick={() => handleCheckout(tier)}
                  variant={tier.highlight ? 'default' : 'outline'}
                  className={cn('w-full mb-6', tier.highlight && 'shadow-lg')}
                >
                  {tier.cta}
                </Button>

                <ul className="space-y-3 flex-1">
                  {tier.features.map((feature, featureIdx) => (
                    <li
                      key={featureIdx}
                      className="flex items-start gap-3 text-sm"
                    >
                      <Check
                        className={cn(
                          'h-4 w-4 mt-0.5 flex-shrink-0',
                          tier.highlight ? 'text-primary' : 'text-muted-foreground'
                        )}
                      />
                      <span
                        className={cn(
                          feature.startsWith('Everything')
                            ? 'font-medium text-foreground'
                            : 'text-muted-foreground'
                        )}
                      >
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="py-16 px-6 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            {[
              {
                icon: Shield,
                title: 'Read-only Stripe access',
                description: 'Connect via OAuth. We never modify your Stripe data.',
              },
              {
                icon: Zap,
                title: 'Fast time-to-value',
                description: 'Connect Stripe and get insights in minutes, not weeks.',
              },
              {
                icon: Users,
                title: 'Built for B2B SaaS',
                description: 'Pricing, churn, discounts, and plan complexity—handled.',
              },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex flex-col items-center"
              >
                <div className="rounded-xl bg-primary/10 p-4 mb-4">
                  <item.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold tracking-tight">
              Frequently asked questions
            </h2>
            <p className="mt-3 text-muted-foreground">
              Everything you need to know about pricing
            </p>
          </motion.div>

          <div className="space-y-6">
            {faqs.map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="rounded-xl border border-border bg-card p-6"
              >
                <h3 className="font-semibold">{faq.question}</h3>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                  {faq.answer}
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
              Start your 14-day free trial today. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
              <Link href="/login">
                <Button
                  size="lg"
                  className="bg-white text-primary hover:bg-white/90 gap-2"
                >
                  Start Free Trial
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="mailto:sales@rev.ai">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/30 text-white hover:bg-white/10"
                >
                  Talk to Sales
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
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

