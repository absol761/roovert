'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, Users, Zap, Code, Brain, Globe, Heart, Mail, Github } from 'lucide-react';

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

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] relative overflow-hidden transition-colors duration-500">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[var(--accent)]/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[var(--accent)]/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[var(--background)]/80 backdrop-blur-xl border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-6 py-4">
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
      <section className="relative z-10 pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-4xl mx-auto space-y-8"
          >
            <div className="inline-flex items-center gap-2 text-xs font-mono tracking-[0.35em] uppercase text-[var(--foreground)]/50">
              <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse"></span>
              Join Us
            </div>
            <h1 className="text-6xl md:text-8xl font-light leading-tight">
              <span className="block">We're Looking for</span>
              <span className="block text-[var(--accent)] opacity-90">People to Join</span>
            </h1>
            <p className="text-xl text-[var(--foreground)]/60 font-light max-w-2xl mx-auto">
              Roovert is growing. We're looking for developers, designers, researchers, and anyone passionate about building better AI tools. Whether you're experienced or just starting out, we'd love to hear from you.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Ways to Contribute */}
      <section className="relative z-10 py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-light mb-4">Ways to Contribute</h2>
            <p className="text-lg text-[var(--foreground)]/60 max-w-2xl mx-auto">
              There are many ways to get involved with Roovert
            </p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {waysToContribute.map((way, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="glass-panel bg-[var(--panel-bg)] backdrop-blur-xl border border-[var(--border)] rounded-xl p-6 hover:border-[var(--accent)]/40 transition-all"
              >
                <div className="p-3 rounded-lg bg-[var(--accent)]/10 w-fit mb-4">
                  <way.icon className="w-6 h-6 text-[var(--accent)]" />
                </div>
                <h3 className="text-lg font-medium text-[var(--foreground)] mb-2">{way.title}</h3>
                <p className="text-sm text-[var(--muted)] leading-relaxed">{way.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Internships & Opportunities */}
      <section className="relative z-10 py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="glass-panel bg-[var(--panel-bg)] backdrop-blur-xl border border-[var(--border)] rounded-2xl p-12"
          >
            <div className="text-center mb-8">
              <h2 className="text-4xl font-light mb-4">Internships & Opportunities</h2>
              <p className="text-lg text-[var(--foreground)]/60 max-w-2xl mx-auto">
                We're open to internships, part-time contributions, and full-time roles. If you're interested in working on Roovert, reach out.
              </p>
            </div>
            <div className="space-y-6 text-[var(--muted)]">
              <div className="flex items-start gap-4">
                <Zap className="w-5 h-5 text-[var(--accent)] mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-lg font-medium text-[var(--foreground)] mb-2">What We're Looking For</h3>
                  <p className="text-sm leading-relaxed">
                    People who care about building better AI tools. Experience level doesn't matter as much as curiosity and willingness to learn. We're particularly interested in developers, designers, and anyone with ideas about how to improve AI interfaces.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <Globe className="w-5 h-5 text-[var(--accent)] mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-lg font-medium text-[var(--foreground)] mb-2">Remote & Flexible</h3>
                  <p className="text-sm leading-relaxed">
                    We work remotely and are flexible with schedules. Whether you're a student looking for an internship, someone wanting to contribute part-time, or looking for a full-time role, we're open to discussing what works.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <Heart className="w-5 h-5 text-[var(--accent)] mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-lg font-medium text-[var(--foreground)] mb-2">Open Source</h3>
                  <p className="text-sm leading-relaxed">
                    Much of what we build is open source. You can contribute through GitHub, help with documentation, or suggest features. Every contribution matters.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Get in Touch */}
      <section className="relative z-10 py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="glass-panel bg-[var(--panel-bg)] backdrop-blur-xl border border-[var(--border)] rounded-2xl p-12 text-center"
          >
            <h2 className="text-4xl font-light mb-4">Get in Touch</h2>
            <p className="text-lg text-[var(--foreground)]/60 mb-8 max-w-2xl mx-auto">
              Interested in joining? Have questions? Want to contribute? We'd love to hear from you.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="mailto:careers@roovert.com"
                className="px-8 py-4 bg-[var(--accent)] text-white text-lg font-medium rounded-full hover:opacity-90 transition-all shadow-[0_0_40px_var(--accent-glow)] flex items-center gap-3"
              >
                <Mail className="w-5 h-5" />
                Email Us
              </a>
              <a
                href="https://github.com/absol761/roovert"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-4 border border-[var(--border)] text-[var(--foreground)] text-lg font-medium rounded-full hover:border-[var(--accent)] hover:bg-[var(--surface)] transition-all flex items-center gap-3"
              >
                <Github className="w-5 h-5" />
                View on GitHub
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-12 px-6 border-t border-[var(--border)]">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-sm text-[var(--muted)]">
            Roovert · Building the future of AI intelligence
          </p>
        </div>
      </footer>
    </div>
  );
}

