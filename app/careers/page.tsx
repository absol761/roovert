'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Users, Zap, Code, Brain, Globe, Heart, Mail, Sparkles } from 'lucide-react';

// lucide-react dropped brand/logo icons (incl. Github) - inline the mark instead
function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.09 3.29 9.4 7.86 10.93.58.1.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.53-1.33-1.29-1.69-1.29-1.69-1.05-.72.08-.7.08-.7 1.17.08 1.78 1.2 1.78 1.2 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.68 0-1.25.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.64 1.59.24 2.76.12 3.05.74.8 1.19 1.83 1.19 3.08 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14 0 1.55-.01 2.79-.01 3.17 0 .31.21.67.8.56A10.52 10.52 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
    </svg>
  );
}

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
};

const stagger = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.09, delayChildren: 0.05 },
  },
};

export default function CareersPage() {

  const waysToContribute = [
    {
      icon: Code,
      title: 'Development',
      description: 'Help build features, fix bugs, or improve performance. We welcome contributions of all sizes.',
    },
    {
      icon: Brain,
      title: 'AI Research',
      description: 'Experiment with new models, test capabilities, or suggest improvements to our AI integration.',
    },
    {
      icon: Heart,
      title: 'Design & UX',
      description: 'Improve the interface, suggest new themes, or help make Roovert more accessible.',
    },
    {
      icon: Users,
      title: 'Community',
      description: 'Help grow the community, write documentation, or share Roovert with others.',
    },
  ];

  const opportunities = [
    {
      icon: Zap,
      title: 'What We’re Looking For',
      description:
        'People who care about building better AI tools. Experience level doesn’t matter as much as curiosity and willingness to learn. We’re particularly interested in developers, designers, and anyone with ideas about how to improve AI interfaces.',
    },
    {
      icon: Globe,
      title: 'Remote & Flexible',
      description:
        'We work remotely and are flexible with schedules. Whether you’re a student looking for an internship, someone wanting to contribute part-time, or looking for a full-time role, we’re open to discussing what works.',
    },
    {
      icon: Heart,
      title: 'Open Source',
      description:
        'Much of what we build is open source. You can contribute through GitHub, help with documentation, or suggest features. Every contribution matters.',
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] relative overflow-hidden transition-colors duration-500">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[var(--accent)]/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[var(--accent)]/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[36rem] h-[36rem] bg-[var(--accent)]/5 rounded-full blur-3xl"></div>
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[var(--background)]/80 backdrop-blur-xl border-b border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="text-2xl font-bold bg-gradient-to-r from-[var(--foreground)] to-[var(--accent)] bg-clip-text text-transparent hover:opacity-80 transition-opacity"
            >
              ROOVERT
            </Link>
            <Link
              href="/"
              className="flex items-center gap-2 text-sm text-[var(--foreground)]/70 hover:text-[var(--accent)] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 pt-40 pb-24 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            animate="show"
            variants={stagger}
            className="text-center max-w-3xl mx-auto"
          >
            <motion.div
              variants={fadeUp}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel-bg)] backdrop-blur-xl px-4 py-1.5 text-xs font-mono tracking-[0.3em] uppercase text-[var(--foreground)]/60 mb-8"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse"></span>
              Join Us
            </motion.div>
            <motion.h1
              variants={fadeUp}
              transition={{ duration: 0.6 }}
              className="text-6xl sm:text-7xl md:text-8xl font-light leading-[0.95] tracking-tight"
            >
              <span className="block">We&rsquo;re Looking for</span>
              <span className="block bg-gradient-to-r from-[var(--accent)] to-[var(--foreground)] bg-clip-text text-transparent">
                People to Join
              </span>
            </motion.h1>
            <motion.p
              variants={fadeUp}
              transition={{ duration: 0.6 }}
              className="mt-8 text-lg md:text-xl text-[var(--foreground)]/60 font-light leading-relaxed max-w-2xl mx-auto text-balance"
            >
              Roovert is growing. We&rsquo;re looking for developers, designers, researchers, and anyone passionate
              about building better AI tools. Whether you&rsquo;re experienced or just starting out, we&rsquo;d love
              to hear from you.
            </motion.p>
            <motion.div variants={fadeUp} transition={{ duration: 0.5 }} className="mt-10 flex justify-center">
              <a
                href="#contact"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--accent)] text-white text-sm font-medium rounded-full hover:opacity-90 transition-all shadow-[0_0_40px_var(--accent-glow)]"
              >
                <Sparkles className="w-4 h-4" />
                Get in Touch
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Ways to Contribute */}
      <section className="relative z-10 py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6 }}
            className="mb-12 md:mb-16 max-w-2xl"
          >
            <span className="text-xs font-mono tracking-[0.3em] uppercase text-[var(--accent)]">01 &mdash; Get Involved</span>
            <h2 className="mt-3 text-3xl md:text-4xl font-light tracking-tight">Ways to Contribute</h2>
            <p className="mt-3 text-lg text-[var(--foreground)]/60 leading-relaxed">
              There are many ways to get involved with Roovert
            </p>
          </motion.div>
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
          >
            {waysToContribute.map((way, idx) => (
              <motion.div
                key={idx}
                variants={fadeUp}
                transition={{ duration: 0.5 }}
                whileHover={{
                  y: -8,
                  scale: 1.02,
                  transition: { duration: 0.3, ease: 'easeOut' },
                }}
                className="career-card glass-panel bg-[var(--panel-bg)] backdrop-blur-xl border border-[var(--border)] rounded-2xl p-6 hover:border-[var(--accent)]/60 transition-all cursor-default group relative"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />

                <motion.div
                  className="career-icon p-3 rounded-xl bg-[var(--accent)]/10 w-fit mb-5 relative z-10"
                  whileHover={{ rotate: [0, -5, 5, 0], scale: 1.08 }}
                  transition={{ duration: 0.4, ease: 'easeInOut' }}
                >
                  <way.icon className="w-6 h-6 text-[var(--accent)]" />
                </motion.div>

                <div className="relative z-10">
                  <h3 className="text-lg font-medium text-[var(--foreground)] mb-2 group-hover:text-[var(--accent)] transition-colors">
                    {way.title}
                  </h3>
                  <p className="text-sm text-[var(--muted)] leading-relaxed">
                    {way.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Internships & Opportunities */}
      <section className="relative z-10 py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6 }}
            className="glass-panel bg-[var(--panel-bg)] backdrop-blur-xl border border-[var(--border)] rounded-3xl p-8 md:p-12"
          >
            <div className="mb-10">
              <span className="text-xs font-mono tracking-[0.3em] uppercase text-[var(--accent)]">02 &mdash; Opportunities</span>
              <h2 className="mt-3 text-3xl md:text-4xl font-light tracking-tight">Internships & Opportunities</h2>
              <p className="mt-3 text-lg text-[var(--foreground)]/60 leading-relaxed max-w-2xl">
                We&rsquo;re open to internships, part-time contributions, and full-time roles. If you&rsquo;re
                interested in working on Roovert, reach out.
              </p>
            </div>
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-80px' }}
              variants={stagger}
              className="space-y-3"
            >
              {opportunities.map((item, idx) => (
                <motion.div
                  key={idx}
                  variants={fadeUp}
                  transition={{ duration: 0.5 }}
                  className="flex items-start gap-4 rounded-2xl border border-transparent hover:border-[var(--border)] hover:bg-[var(--surface)] transition-all p-4 -mx-4"
                >
                  <div className="p-2.5 rounded-lg bg-[var(--accent)]/10 flex-shrink-0">
                    <item.icon className="w-5 h-5 text-[var(--accent)]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-[var(--foreground)] mb-1.5">{item.title}</h3>
                    <p className="text-sm text-[var(--muted)] leading-relaxed max-w-2xl">{item.description}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Get in Touch */}
      <section id="contact" className="relative z-10 py-20 px-6 scroll-mt-24">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6 }}
            className="glass-panel bg-[var(--panel-bg)] backdrop-blur-xl border border-[var(--border)] rounded-3xl p-10 md:p-14 text-center relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-[var(--accent)]/5 to-transparent pointer-events-none" />
            <div className="relative z-10">
              <span className="text-xs font-mono tracking-[0.3em] uppercase text-[var(--accent)]">03 &mdash; Say Hello</span>
              <h2 className="mt-3 text-3xl md:text-4xl font-light tracking-tight">Get in Touch</h2>
              <p className="mt-3 text-lg text-[var(--foreground)]/60 mb-9 max-w-2xl mx-auto leading-relaxed">
                Interested in joining? Have questions? Want to contribute? We&rsquo;d love to hear from you.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a
                  href="mailto:careers@roovert.com"
                  className="w-full sm:w-auto px-8 py-4 bg-[var(--accent)] text-white text-base font-medium rounded-full hover:opacity-90 transition-all shadow-[0_0_40px_var(--accent-glow)] flex items-center justify-center gap-3"
                >
                  <Mail className="w-5 h-5" />
                  Email Us
                </a>
                <a
                  href="https://github.com/absol761/roovert"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-8 py-4 border border-[var(--border)] text-[var(--foreground)] text-base font-medium rounded-full hover:border-[var(--accent)] hover:bg-[var(--surface)] transition-all flex items-center justify-center gap-3 group"
                >
                  <GithubIcon className="w-5 h-5" />
                  View on GitHub
                  <ArrowUpRight className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-12 px-6 border-t border-[var(--border)]">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-sm text-[var(--muted)]">
            Roovert &middot; Building the future of AI intelligence
          </p>
        </div>
      </footer>
    </div>
  );
}
