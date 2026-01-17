'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, Shield, Lock, Eye, FileText, Mail } from 'lucide-react';

export default function PrivacyPage() {
  const lastUpdated = 'January 2025';

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

      {/* Main Content */}
      <main className="relative z-10 pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto space-y-12">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center space-y-4"
          >
            <div className="inline-flex items-center gap-2 text-xs font-mono tracking-[0.35em] uppercase text-[var(--foreground)]/50">
              <Shield className="w-4 h-4" />
              Privacy Policy
            </div>
            <h1 className="text-5xl md:text-6xl font-light leading-tight">
              Your Privacy Matters
            </h1>
            <p className="text-lg text-[var(--foreground)]/60 max-w-2xl mx-auto">
              We are committed to protecting your privacy. This policy explains how we collect, use, and protect your information.
            </p>
            <p className="text-sm text-[var(--muted)]">
              Last updated: {lastUpdated}
            </p>
          </motion.div>

          {/* Policy Content */}
          <div className="space-y-8">
            {/* Introduction */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="glass-panel bg-[var(--panel-bg)] backdrop-blur-xl border border-[var(--border)] rounded-2xl p-8"
            >
              <h2 className="text-2xl font-light mb-4 flex items-center gap-3">
                <FileText className="w-6 h-6 text-[var(--accent)]" />
                1. Introduction
              </h2>
              <div className="space-y-4 text-[var(--foreground)]/80 leading-relaxed">
                <p>
                  Roovert ("we," "our," or "us") operates the Roovert website and AI chat interface. We are committed to protecting your privacy and ensuring transparency about how we handle your data.
                </p>
                <p>
                  This Privacy Policy explains what information we collect, how we use it, and your rights regarding your personal data. By using Roovert, you agree to the collection and use of information in accordance with this policy.
                </p>
              </div>
            </motion.section>

            {/* Information We Collect */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="glass-panel bg-[var(--panel-bg)] backdrop-blur-xl border border-[var(--border)] rounded-2xl p-8"
            >
              <h2 className="text-2xl font-light mb-4 flex items-center gap-3">
                <Eye className="w-6 h-6 text-[var(--accent)]" />
                2. Information We Collect
              </h2>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-3">2.1 Automatically Collected Information</h3>
                  <p className="text-[var(--foreground)]/80 leading-relaxed mb-3">
                    When you visit Roovert, we automatically collect certain information for analytics and service improvement:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-[var(--foreground)]/80 ml-4">
                    <li><strong>IP Address:</strong> We collect your IP address, but immediately hash it using SHA-256 encryption. We never store your raw IP address.</li>
                    <li><strong>User-Agent:</strong> Your browser's user-agent string is collected and hashed (not stored in raw form) to help identify unique visitors.</li>
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
                    <li><strong>Chat History:</strong> Your conversation history is stored in your browser's localStorage and is never transmitted to our servers.</li>
                    <li><strong>Settings Preferences:</strong> Your interface preferences (themes, layouts, etc.) are stored locally in your browser.</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-medium mb-3">2.3 Analytics Information (With Consent)</h3>
                  <p className="text-[var(--foreground)]/80 leading-relaxed mb-3">
                    If you consent to analytics cookies, we use Segment.io to collect:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-[var(--foreground)]/80 ml-4">
                    <li><strong>Page Views:</strong> Which pages you visit and when.</li>
                    <li><strong>Anonymized IP Addresses:</strong> All IP addresses are anonymized to 0.0.0.0 before being sent to analytics services.</li>
                    <li><strong>No Personal Identification:</strong> We do not use Segment.io's identify() function. All tracking is completely anonymous.</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-medium mb-3">2.4 Information We Do NOT Collect</h3>
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
            </motion.section>

            {/* How We Use Information */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="glass-panel bg-[var(--panel-bg)] backdrop-blur-xl border border-[var(--border)] rounded-2xl p-8"
            >
              <h2 className="text-2xl font-light mb-4">3. How We Use Your Information</h2>
              <div className="space-y-4 text-[var(--foreground)]/80 leading-relaxed">
                <p>We use the collected information for the following purposes:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong>Analytics:</strong> To understand how many unique visitors use Roovert and how they interact with the site.</li>
                  <li><strong>Service Improvement:</strong> To improve the functionality and user experience of Roovert.</li>
                  <li><strong>Technical Support:</strong> To diagnose technical issues and ensure the service operates correctly.</li>
                  <li><strong>Security:</strong> To detect and prevent abuse, fraud, or security threats.</li>
                </ul>
                <p className="mt-4">
                  <strong>We do not:</strong> Sell your data, use it for advertising, share it with third parties (except as described below), or use it to identify you personally.
                </p>
              </div>
            </motion.section>

            {/* Data Storage and Security */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="glass-panel bg-[var(--panel-bg)] backdrop-blur-xl border border-[var(--border)] rounded-2xl p-8"
            >
              <h2 className="text-2xl font-light mb-4 flex items-center gap-3">
                <Lock className="w-6 h-6 text-[var(--accent)]" />
                4. Data Storage and Security
              </h2>
              <div className="space-y-4 text-[var(--foreground)]/80 leading-relaxed">
                <div>
                  <h3 className="text-lg font-medium mb-3">4.1 Data Storage</h3>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li><strong>Visitor Hashes:</strong> Stored in Vercel KV (Redis) or SQLite database. These are one-way hashes that cannot be reversed.</li>
                    <li><strong>Analytics Data:</strong> Stored by Segment.io (if you consent) in accordance with their privacy policy.</li>
                    <li><strong>Local Data:</strong> Your chat history and settings are stored only in your browser's localStorage and are never sent to our servers.</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-medium mb-3">4.2 Data Retention</h3>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Visitor hashes are retained indefinitely to maintain accurate unique visitor counts.</li>
                    <li>Analytics data (if consented) is retained according to Segment.io's retention policies.</li>
                    <li>You can clear your local data at any time by clearing your browser's localStorage.</li>
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
            </motion.section>

            {/* Third-Party Services */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="glass-panel bg-[var(--panel-bg)] backdrop-blur-xl border border-[var(--border)] rounded-2xl p-8"
            >
              <h2 className="text-2xl font-light mb-4">5. Third-Party Services</h2>
              <div className="space-y-4 text-[var(--foreground)]/80 leading-relaxed">
                <p>We use the following third-party services:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong>Segment.io:</strong> Analytics service (only loaded with your consent). All IP addresses are anonymized before being sent. See <a href="https://segment.com/legal/privacy/" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">Segment's Privacy Policy</a>.</li>
                  <li><strong>Vercel:</strong> Hosting and infrastructure provider. See <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">Vercel's Privacy Policy</a>.</li>
                </ul>
              </div>
            </motion.section>

            {/* Cookies and Local Storage */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="glass-panel bg-[var(--panel-bg)] backdrop-blur-xl border border-[var(--border)] rounded-2xl p-8"
            >
              <h2 className="text-2xl font-light mb-4">6. Cookies and Local Storage</h2>
              <div className="space-y-4 text-[var(--foreground)]/80 leading-relaxed">
                <p>We use browser localStorage (not traditional cookies) to store:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong>Analytics Consent:</strong> Your choice to accept or decline analytics tracking.</li>
                  <li><strong>Visitor ID:</strong> A local identifier to help track unique visits (stored only in your browser).</li>
                  <li><strong>Chat History:</strong> Your conversation history (stored only in your browser).</li>
                  <li><strong>Settings:</strong> Your interface preferences and settings.</li>
                </ul>
                <p className="mt-4">
                  You can clear all this data at any time by clearing your browser's localStorage. This will not affect your ability to use Roovert.
                </p>
              </div>
            </motion.section>

            {/* Your Rights */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
              className="glass-panel bg-[var(--panel-bg)] backdrop-blur-xl border border-[var(--border)] rounded-2xl p-8"
            >
              <h2 className="text-2xl font-light mb-4">7. Your Rights</h2>
              <div className="space-y-4 text-[var(--foreground)]/80 leading-relaxed">
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
            </motion.section>

            {/* Children's Privacy */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="glass-panel bg-[var(--panel-bg)] backdrop-blur-xl border border-[var(--border)] rounded-2xl p-8"
            >
              <h2 className="text-2xl font-light mb-4">8. Children's Privacy</h2>
              <p className="text-[var(--foreground)]/80 leading-relaxed">
                Roovert is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us and we will delete such information.
              </p>
            </motion.section>

            {/* Changes to This Policy */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.9 }}
              className="glass-panel bg-[var(--panel-bg)] backdrop-blur-xl border border-[var(--border)] rounded-2xl p-8"
            >
              <h2 className="text-2xl font-light mb-4">9. Changes to This Privacy Policy</h2>
              <p className="text-[var(--foreground)]/80 leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date. You are advised to review this Privacy Policy periodically for any changes.
              </p>
            </motion.section>

            {/* Contact Us */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.0 }}
              className="glass-panel bg-[var(--panel-bg)] backdrop-blur-xl border border-[var(--border)] rounded-2xl p-8"
            >
              <h2 className="text-2xl font-light mb-4 flex items-center gap-3">
                <Mail className="w-6 h-6 text-[var(--accent)]" />
                10. Contact Us
              </h2>
              <div className="space-y-4 text-[var(--foreground)]/80 leading-relaxed">
                <p>
                  If you have any questions about this Privacy Policy or wish to exercise your privacy rights, please contact us:
                </p>
                <div className="bg-[var(--surface-strong)] rounded-lg p-4 border border-[var(--border)]">
                  <p className="font-medium mb-2">Email:</p>
                  <a href="mailto:privacy@roovert.com" className="text-[var(--accent)] hover:underline">
                    privacy@roovert.com
                  </a>
                </div>
                <p className="text-sm text-[var(--muted)]">
                  We will respond to your inquiry within 30 days as required by applicable privacy laws.
                </p>
              </div>
            </motion.section>
          </div>
        </div>
      </main>

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

