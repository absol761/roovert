'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, MapPin, Clock, Briefcase, Users, Zap, Code, Brain, Globe, Heart, TrendingUp, CheckCircle, ExternalLink } from 'lucide-react';

export default function CareersPage() {
  const jobOpenings = [
    {
      id: 1,
      title: 'Senior AI Engineer',
      department: 'Engineering',
      location: 'Remote / San Francisco',
      type: 'Full-time',
      description: 'Build and optimize AI models, work with cutting-edge LLMs, and shape the future of AI interaction.',
      requirements: [
        '5+ years in ML/AI engineering',
        'Experience with transformer architectures',
        'Strong Python and TypeScript skills',
        'Passion for open-source AI'
      ],
      icon: Brain,
    },
    {
      id: 2,
      title: 'Full-Stack Developer',
      department: 'Engineering',
      location: 'Remote / New York',
      type: 'Full-time',
      description: 'Create beautiful, performant interfaces for AI interactions. Build the next generation of AI tools.',
      requirements: [
        '3+ years full-stack experience',
        'React, Next.js, TypeScript expertise',
        'Experience with real-time systems',
        'Eye for design and UX'
      ],
      icon: Code,
    },
    {
      id: 3,
      title: 'AI Research Scientist',
      department: 'Research',
      location: 'Remote / London',
      type: 'Full-time',
      description: 'Push the boundaries of AI capabilities. Research new model architectures and training methods.',
      requirements: [
        'PhD in ML/AI or equivalent',
        'Published research in top venues',
        'Experience with large-scale training',
        'Strong mathematical background'
      ],
      icon: TrendingUp,
    },
    {
      id: 4,
      title: 'Product Designer',
      department: 'Design',
      location: 'Remote / Anywhere',
      type: 'Full-time',
      description: 'Design intuitive AI interfaces. Create experiences that make complex AI accessible to everyone.',
      requirements: [
        '4+ years product design experience',
        'Portfolio of AI/ML products',
        'Strong UX research skills',
        'Figma and prototyping expertise'
      ],
      icon: Heart,
    },
    {
      id: 5,
      title: 'Developer Relations',
      department: 'Community',
      location: 'Remote / Anywhere',
      type: 'Full-time',
      description: 'Build relationships with developers, create content, and grow the Roovert community.',
      requirements: [
        '2+ years DevRel experience',
        'Strong technical writing',
        'Public speaking experience',
        'Passion for developer tools'
      ],
      icon: Users,
    },
    {
      id: 6,
      title: 'Infrastructure Engineer',
      department: 'Engineering',
      location: 'Remote / Seattle',
      type: 'Full-time',
      description: 'Scale our infrastructure to handle millions of requests. Optimize performance and reliability.',
      requirements: [
        '4+ years infrastructure experience',
        'Kubernetes, AWS, Vercel expertise',
        'Experience with high-traffic systems',
        'Strong problem-solving skills'
      ],
      icon: Zap,
    },
  ];

  const benefits = [
    {
      icon: Globe,
      title: 'Remote First',
      description: 'Work from anywhere in the world. We believe in async-first collaboration.',
    },
    {
      icon: Zap,
      title: 'Cutting-Edge Tech',
      description: 'Work with the latest AI models and technologies. Shape the future of AI.',
    },
    {
      icon: Heart,
      title: 'Health & Wellness',
      description: 'Comprehensive health insurance, mental health support, and wellness programs.',
    },
    {
      icon: Briefcase,
      title: 'Learning Budget',
      description: '$5,000 annual learning budget for courses, conferences, and books.',
    },
    {
      icon: Users,
      title: 'Team Retreats',
      description: 'Quarterly team meetups in amazing locations around the world.',
    },
    {
      icon: CheckCircle,
      title: 'Equity & Benefits',
      description: 'Competitive salary, equity package, and comprehensive benefits.',
    },
  ];

  const values = [
    {
      title: 'Truth First',
      description: 'We prioritize accuracy and truth over convenience. We build tools that help people find real answers.',
    },
    {
      title: 'Open Source',
      description: 'We believe in open-source AI. We contribute to the community and share our learnings.',
    },
    {
      title: 'User Privacy',
      description: 'Privacy is fundamental. We build with privacy-by-design principles.',
    },
    {
      title: 'Innovation',
      description: 'We move fast, experiment, and aren\'t afraid to challenge the status quo.',
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
              Join the Team
            </div>
            <h1 className="text-6xl md:text-8xl font-light leading-tight">
              <span className="block">Build the Future of</span>
              <span className="block text-[var(--accent)] opacity-90">AI Intelligence</span>
            </h1>
            <p className="text-xl text-[var(--foreground)]/60 font-light max-w-2xl mx-auto">
              We're building tools that make AI accessible, truthful, and powerful. Join us in shaping how humans interact with artificial intelligence.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Values Section */}
      <section className="relative z-10 py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-light mb-4">Our Values</h2>
            <p className="text-lg text-[var(--foreground)]/60 max-w-2xl mx-auto">
              What drives us every day
            </p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="glass-panel bg-[var(--panel-bg)] backdrop-blur-xl border border-[var(--border)] rounded-xl p-6 hover:border-[var(--accent)]/40 transition-all"
              >
                <h3 className="text-lg font-medium text-[var(--foreground)] mb-3">{value.title}</h3>
                <p className="text-sm text-[var(--muted)] leading-relaxed">{value.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Open Positions */}
      <section className="relative z-10 py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-light mb-4">Open Positions</h2>
            <p className="text-lg text-[var(--foreground)]/60 max-w-2xl mx-auto">
              We're always looking for exceptional people to join our team
            </p>
          </motion.div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {jobOpenings.map((job, idx) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="glass-panel bg-[var(--panel-bg)] backdrop-blur-xl border border-[var(--border)] rounded-xl p-6 hover:border-[var(--accent)]/40 transition-all group"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="p-3 rounded-lg bg-[var(--accent)]/10 group-hover:bg-[var(--accent)]/20 transition-colors">
                    <job.icon className="w-6 h-6 text-[var(--accent)]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-medium text-[var(--foreground)] mb-2 group-hover:text-[var(--accent)] transition-colors">
                      {job.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--muted)] mb-3">
                      <span className="flex items-center gap-1">
                        <Briefcase className="w-3 h-3" />
                        {job.department}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {job.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {job.type}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-[var(--muted)] mb-4 leading-relaxed">{job.description}</p>
                <div className="mb-4">
                  <h4 className="text-xs uppercase tracking-wider text-[var(--foreground)]/50 mb-2 font-mono">Key Requirements</h4>
                  <ul className="space-y-2">
                    {job.requirements.map((req, reqIdx) => (
                      <li key={reqIdx} className="flex items-start gap-2 text-sm text-[var(--muted)]">
                        <CheckCircle className="w-4 h-4 text-[var(--accent)] mt-0.5 flex-shrink-0" />
                        <span>{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <button className="w-full px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-2 group/btn">
                  Apply Now
                  <ExternalLink className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="relative z-10 py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-light mb-4">Benefits & Perks</h2>
            <p className="text-lg text-[var(--foreground)]/60 max-w-2xl mx-auto">
              We take care of our team so you can do your best work
            </p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((benefit, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="glass-panel bg-[var(--panel-bg)] backdrop-blur-xl border border-[var(--border)] rounded-xl p-6 hover:border-[var(--accent)]/40 transition-all"
              >
                <div className="p-3 rounded-lg bg-[var(--accent)]/10 w-fit mb-4">
                  <benefit.icon className="w-6 h-6 text-[var(--accent)]" />
                </div>
                <h3 className="text-lg font-medium text-[var(--foreground)] mb-2">{benefit.title}</h3>
                <p className="text-sm text-[var(--muted)] leading-relaxed">{benefit.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="glass-panel bg-[var(--panel-bg)] backdrop-blur-xl border border-[var(--border)] rounded-2xl p-12 text-center"
          >
            <h2 className="text-4xl font-light mb-4">Don't See a Role That Fits?</h2>
            <p className="text-lg text-[var(--foreground)]/60 mb-8 max-w-2xl mx-auto">
              We're always looking for exceptional people. Send us your resume and tell us how you'd like to contribute.
            </p>
            <button className="px-8 py-4 bg-[var(--accent)] text-white text-lg font-medium rounded-full hover:opacity-90 transition-all shadow-[0_0_40px_var(--accent-glow)] flex items-center gap-3 mx-auto">
              Open Application
              <ExternalLink className="w-5 h-5" />
            </button>
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

