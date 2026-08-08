'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, Shield, Lock, Eye, FileText, Mail, ShieldCheck, ShieldOff, MicOff } from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

function Section({
  id,
  icon: Icon,
  title,
  children,
}: {
  id: string;
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.5 }}
      className="glass-panel bg-[var(--panel-bg)] backdrop-blur-xl border border-[var(--border)] rounded-3xl p-7 md:p-10 scroll-mt-24"
    >
      <h2 className="text-xl md:text-2xl font-light mb-5 flex items-center gap-3 tracking-tight">
        {Icon && (
          <span className="p-2 rounded-lg bg-[var(--accent)]/10 flex-shrink-0">
            <Icon className="w-5 h-5 text-[var(--accent)]" />
          </span>
        )}
        {title}
      </h2>
      <div className="max-w-3xl">{children}</div>
    </motion.section>
  );
}

export default function PrivacyPage() {
  const lastUpdated = 'January 2025';

  const highlights = [
    { icon: ShieldCheck, label: 'IP addresses are hashed, never stored raw' },
    { icon: ShieldOff, label: 'We never sell your data or use it for ads' },
    { icon: MicOff, label: 'Audio is processed locally, never recorded' },
  ];

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] relative overflow-hidden transition-colors duration-500">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[var(--background)]/80 backdrop-blur-xl border-b border-[var(--border)]">
        <div className="max-w-5xl mx-auto px-6 py-4">
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

      {/* Main Content */}
      <main className="relative z-10 pt-36 pb-24 px-6">
        <div className="max-w-4xl mx-auto space-y-16">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel-bg)] backdrop-blur-xl px-4 py-1.5 text-xs font-mono tracking-[0.3em] uppercase text-[var(--foreground)]/60 mb-8">
              <Shield className="w-3.5 h-3.5" />
              Privacy Policy
            </div>
            <h1 className="text-5xl md:text-7xl font-light leading-[0.95] tracking-tight text-balance">
              Your Privacy Matters
            </h1>
            <p className="mt-6 text-lg md:text-xl text-[var(--foreground)]/60 font-light leading-relaxed max-w-2xl mx-auto text-balance">
              We are committed to protecting your privacy. This policy explains how we collect, use, and protect
              your information.
            </p>
            <p className="mt-4 text-sm text-[var(--muted)] font-mono uppercase tracking-wider">
              Last updated: {lastUpdated}
            </p>

            {/* Highlight strip */}
            <motion.div
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.1, delayChildren: 0.3 } } }}
              className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl mx-auto"
            >
              {highlights.map((h, idx) => (
                <motion.div
                  key={idx}
                  variants={fadeUp}
                  transition={{ duration: 0.5 }}
                  className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-left"
                >
                  <h.icon className="w-4 h-4 text-[var(--accent)] flex-shrink-0" />
                  <span className="text-xs text-[var(--muted-strong)] leading-snug">{h.label}</span>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

          {/* Policy Content */}
          <div className="space-y-6">
            {/* Introduction */}
            <Section id="introduction" icon={FileText} title="1. Introduction">
              <div className="space-y-4 text-[var(--foreground)]/80 leading-relaxed">
                <p>
                  Roovert (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) operates the Roovert website and
                  AI chat interface. We are committed to protecting your privacy and ensuring transparency about how
                  we handle your data.
                </p>
                <p>
                  This Privacy Policy explains what information we collect, how we use it, and your rights
                  regarding your personal data. By using Roovert, you agree to the collection and use of
                  information in accordance with this policy.
                </p>
              </div>
            </Section>

            {/* Information We Collect */}
            <Section id="information" icon={Eye} title="2. Information We Collect">
              <div className="space-y-7">
                <div>
                  <h3 className="text-lg font-medium mb-3">2.1 Automatically Collected Information</h3>
                  <p className="text-[var(--foreground)]/80 leading-relaxed mb-3">
                    When you visit Roovert, we automatically collect certain information for analytics and service
                    improvement:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-[var(--foreground)]/80 ml-4">
                    <li><strong>IP Address:</strong> We collect your IP address, but immediately hash it using SHA-256 encryption. We never store your raw IP address.</li>
                    <li><strong>User-Agent:</strong> Your browser&rsquo;s user-agent string is collected and hashed (not stored in raw form) to help identify unique visitors.</li>
                    <li><strong>Visitor Hash:</strong> A unique, anonymized identifier created by hashing your IP address and user-agent together. This cannot be reversed to identify you.</li>
                    <li><strong>Visit Timestamps:</strong> We record when you first visited and your last visit time for analytics purposes.</li>
                    <li><strong>Page Views:</strong> We track which pages you visit to understand how people use Roovert.</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-medium mb-3">2.2 Information You Provide</h3>
                  <p className="text-[var(--foreground)]/80 leading-relaxed mb-3">
                    When you use our AI chat interface:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-[var(--foreground)]/80 ml-4">
                    <li><strong>Chat Queries:</strong> Your questions and prompts are processed by AI models. These are stored locally in your browser and are not sent to our servers unless you submit them.</li>
                    <li><strong>Chat History:</strong> Your conversation history is stored in your browser&rsquo;s localStorage and is never transmitted to our servers.</li>
                    <li><strong>Settings Preferences:</strong> Your interface preferences (themes, layouts, etc.) are stored locally in your browser.</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-medium mb-3">2.3 Audio and Interaction Data (Vibe Mode)</h3>
                  <p className="text-[var(--foreground)]/80 leading-relaxed mb-3">
                    When you enable &ldquo;Vibe Mode&rdquo; with audio reactivity, we request access to your
                    microphone. This is an optional feature that you can enable or disable at any time.
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-[var(--foreground)]/80 ml-4">
                    <li><strong>Microphone Access:</strong> If you choose audio-reactive mode, we request access to your microphone through your browser&rsquo;s standard permissions system. You can grant or deny this permission at any time through your browser settings. We only access your microphone when you explicitly enable audio-reactive Vibe Mode and click &ldquo;Start Audio&rdquo;.</li>
                    <li><strong>Local Processing Only:</strong> All audio data is processed entirely within your browser using the Web Audio API. Raw audio is never recorded, stored, or transmitted to our servers or any third parties.</li>
                    <li><strong>Frequency Analysis:</strong> We analyze audio frequency data in real-time to create visualizations. This analysis happens entirely in your browser using the Web Audio API&rsquo;s AnalyserNode. No audio data leaves your device.</li>
                    <li><strong>No Audio Storage:</strong> We do not record, store, save, or transmit any audio data. All processing is done in real-time and in memory only. When you close the browser tab or disable Vibe Mode, all audio processing stops immediately.</li>
                    <li><strong>Interaction Tracking:</strong> If you choose interaction-reactive mode instead of audio-reactive mode, we track typing speed and mouse movement locally to create visualizations. This data is processed in real-time and never stored or transmitted.</li>
                    <li><strong>Browser Permissions:</strong> Your browser will ask for microphone permission before we can access audio. You can revoke this permission at any time through your browser&rsquo;s settings, which will immediately stop all audio processing.</li>
                    <li><strong>Third-Party Access:</strong> We do not share microphone access or audio data with any third-party services, analytics providers, or advertising networks.</li>
                  </ul>
                  <p className="text-[var(--foreground)]/80 leading-relaxed mt-4">
                    <strong>Your Rights:</strong> You have the right to refuse microphone access, and doing so will
                    not affect your ability to use other features of Roovert. You can disable Vibe Mode at any
                    time, and all audio processing will stop immediately.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-medium mb-3">2.4 Analytics Information (With Consent)</h3>
                  <p className="text-[var(--foreground)]/80 leading-relaxed mb-3">
                    If you consent to analytics cookies, we use Segment.io to collect:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-[var(--foreground)]/80 ml-4">
                    <li><strong>Page Views:</strong> Which pages you visit and when.</li>
                    <li><strong>Anonymized IP Addresses:</strong> All IP addresses are anonymized to 0.0.0.0 before being sent to analytics services.</li>
                    <li><strong>No Personal Identification:</strong> We do not use Segment.io&rsquo;s identify() function. All tracking is completely anonymous.</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-medium mb-3">2.5 Information We Do NOT Collect</h3>
                  <p className="text-[var(--foreground)]/80 leading-relaxed mb-3">
                    We do not collect:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-[var(--foreground)]/80 ml-4">
                    <li>Names, email addresses, or any personally identifiable information</li>
                    <li>Payment information</li>
                    <li>Location data (beyond general timezone)</li>
                    <li>Social media accounts or profiles</li>
                    <li>Any information that could be used to identify you personally</li>
                  </ul>
                </div>
              </div>
            </Section>

            {/* How We Use Information */}
            <Section id="use" title="3. How We Use Your Information">
              <div className="space-y-4 text-[var(--foreground)]/80 leading-relaxed">
                <p>We use the collected information for the following purposes:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong>Analytics:</strong> To understand how many unique visitors use Roovert and how they interact with the site.</li>
                  <li><strong>Service Improvement:</strong> To improve the functionality and user experience of Roovert.</li>
                  <li><strong>Technical Support:</strong> To diagnose technical issues and ensure the service operates correctly.</li>
                  <li><strong>Security:</strong> To detect and prevent abuse, fraud, or security threats.</li>
                </ul>
                <p className="mt-4">
                  <strong>We do not:</strong> Sell your data, use it for advertising, share it with third parties
                  (except as described below), or use it to identify you personally.
                </p>
              </div>
            </Section>

            {/* Data Storage and Security */}
            <Section id="storage" icon={Lock} title="4. Data Storage and Security">
              <div className="space-y-6 text-[var(--foreground)]/80 leading-relaxed">
                <div>
                  <h3 className="text-lg font-medium mb-3">4.1 Data Storage</h3>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li><strong>Visitor Hashes:</strong> Stored in Vercel KV (Redis) or SQLite database. These are one-way hashes that cannot be reversed.</li>
                    <li><strong>Analytics Data:</strong> Stored by Segment.io (if you consent) in accordance with their privacy policy.</li>
                    <li><strong>Local Data:</strong> Your chat history and settings are stored only in your browser&rsquo;s localStorage and are never sent to our servers.</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-medium mb-3">4.2 Data Retention</h3>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Visitor hashes are retained indefinitely to maintain accurate unique visitor counts.</li>
                    <li>Analytics data (if consented) is retained according to Segment.io&rsquo;s retention policies.</li>
                    <li>You can clear your local data at any time by clearing your browser&rsquo;s localStorage.</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-medium mb-3">4.3 Security Measures</h3>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>All IP addresses are hashed using SHA-256 before storage.</li>
                    <li>We use HTTPS encryption for all data transmission.</li>
                    <li>We implement security headers and follow security best practices.</li>
                    <li>We do not store any raw personally identifiable information.</li>
                  </ul>
                </div>
              </div>
            </Section>

            {/* Third-Party Services */}
            <Section id="third-party" title="5. Third-Party Services">
              <div className="space-y-4 text-[var(--foreground)]/80 leading-relaxed">
                <p>We use the following third-party services:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong>Segment.io:</strong> Analytics service (only loaded with your consent). All IP addresses are anonymized before being sent. See <a href="https://segment.com/legal/privacy/" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">Segment&rsquo;s Privacy Policy</a>.</li>
                  <li><strong>Vercel:</strong> Hosting and infrastructure provider. See <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">Vercel&rsquo;s Privacy Policy</a>.</li>
                </ul>
              </div>
            </Section>

            {/* Cookies and Local Storage */}
            <Section id="cookies" title="6. Cookies and Local Storage">
              <div className="space-y-4 text-[var(--foreground)]/80 leading-relaxed">
                <p>We use browser localStorage (not traditional cookies) to store:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong>Analytics Consent:</strong> Your choice to accept or decline analytics tracking.</li>
                  <li><strong>Visitor ID:</strong> A local identifier to help track unique visits (stored only in your browser).</li>
                  <li><strong>Chat History:</strong> Your conversation history (stored only in your browser).</li>
                  <li><strong>Settings:</strong> Your interface preferences and settings.</li>
                </ul>
                <p className="mt-4">
                  You can clear all this data at any time by clearing your browser&rsquo;s localStorage. This will
                  not affect your ability to use Roovert.
                </p>
              </div>
            </Section>

            {/* Your Rights */}
            <Section id="rights" title="7. Your Rights">
              <div className="space-y-6 text-[var(--foreground)]/80 leading-relaxed">
                <p>Depending on your location, you may have the following rights:</p>
                <div>
                  <h3 className="text-lg font-medium mb-3">7.1 GDPR Rights (EU Users)</h3>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li><strong>Right to Access:</strong> Request information about what data we have about you.</li>
                    <li><strong>Right to Rectification:</strong> Request correction of inaccurate data.</li>
                    <li><strong>Right to Erasure:</strong> Request deletion of your data.</li>
                    <li><strong>Right to Restrict Processing:</strong> Request limitation of how we process your data.</li>
                    <li><strong>Right to Data Portability:</strong> Request your data in a portable format.</li>
                    <li><strong>Right to Object:</strong> Object to processing of your data.</li>
                    <li><strong>Right to Withdraw Consent:</strong> Withdraw consent for analytics at any time.</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-medium mb-3">7.2 CCPA Rights (California Users)</h3>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li><strong>Right to Know:</strong> Request information about what personal information we collect, use, and share.</li>
                    <li><strong>Right to Delete:</strong> Request deletion of your personal information.</li>
                    <li><strong>Right to Opt-Out:</strong> Opt-out of the sale of personal information (we do not sell your data).</li>
                    <li><strong>Right to Non-Discrimination:</strong> We will not discriminate against you for exercising your privacy rights.</li>
                  </ul>
                </div>
                <p className="mt-4">
                  To exercise these rights, please contact us at the email address provided below.
                </p>
              </div>
            </Section>

            {/* Children's Privacy */}
            <Section id="children" title="8. Children's Privacy">
              <p className="text-[var(--foreground)]/80 leading-relaxed">
                Roovert is not intended for children under 13 years of age. We do not knowingly collect personal
                information from children under 13. If you are a parent or guardian and believe your child has
                provided us with personal information, please contact us and we will delete such information.
              </p>
            </Section>

            {/* Changes to This Policy */}
            <Section id="changes" title="9. Changes to This Privacy Policy">
              <p className="text-[var(--foreground)]/80 leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting
                the new Privacy Policy on this page and updating the &ldquo;Last updated&rdquo; date. You are
                advised to review this Privacy Policy periodically for any changes.
              </p>
            </Section>

            {/* Contact Us */}
            <Section id="contact" icon={Mail} title="10. Contact Us">
              <div className="space-y-4 text-[var(--foreground)]/80 leading-relaxed">
                <p>
                  If you have any questions about this Privacy Policy or wish to exercise your privacy rights,
                  please contact us:
                </p>
                <div className="bg-[var(--surface-strong)] rounded-2xl p-5 border border-[var(--border)] flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-xs font-mono uppercase tracking-wider text-[var(--muted)] mb-1">Email</p>
                    <a href="mailto:privacy@roovert.com" className="text-[var(--accent)] hover:underline font-medium">
                      privacy@roovert.com
                    </a>
                  </div>
                  <a
                    href="mailto:privacy@roovert.com"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--accent)] text-white text-sm font-medium rounded-full hover:opacity-90 transition-all"
                  >
                    <Mail className="w-4 h-4" />
                    Contact Us
                  </a>
                </div>
                <p className="text-sm text-[var(--muted)]">
                  We will respond to your inquiry within 30 days as required by applicable privacy laws.
                </p>
              </div>
            </Section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-12 px-6 border-t border-[var(--border)]">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-sm text-[var(--muted)]">
            Roovert &middot; Building the future of AI intelligence
          </p>
        </div>
      </footer>
    </div>
  );
}
