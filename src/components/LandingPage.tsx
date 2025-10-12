import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, BookOpen, Brain, MessageSquare, Keyboard } from 'lucide-react';
import { Button } from './ui/button';
import { AuthModal } from './AuthModal';

interface LandingPageProps {
  onEnterApp: () => void;
}

export function LandingPage({ onEnterApp }: LandingPageProps) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [scrollY, setScrollY] = useState(0);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const features = [
    {
      icon: BookOpen,
      title: 'PDF.js Rendering',
      description: 'Native PDF rendering with precise text selection and char-offset mapping',
    },
    {
      icon: Brain,
      title: 'Local AI Processing',
      description: 'On-device inference for instant explanations without server round-trips',
    },
    {
      icon: MessageSquare,
      title: 'Context-Aware Chat',
      description: 'Claude integration with automatic context injection and source attribution',
    },
    {
      icon: Keyboard,
      title: 'Keyboard-First',
      description: 'Vim-inspired navigation (j/k/n/r) for power users who move fast',
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Subtle gradient background effect */}
      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute w-[600px] h-[600px] rounded-full opacity-[0.02] blur-3xl transition-all duration-500"
          style={{
            background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)',
            left: mousePosition.x - 300,
            top: mousePosition.y - 300,
          }}
        />
      </div>

      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm"
      >
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-accent rounded" />
            <span className="text-sm tracking-tight">ReadAI</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAuthModal(true)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign In
            </button>
            <Button
              onClick={() => setShowAuthModal(true)}
              size="sm"
              className="h-8 px-4 text-xs bg-accent hover:bg-accent/90"
            >
              Get Started
            </Button>
          </div>
        </div>
      </motion.header>

      {/* Hero Section */}
      <section className="min-h-screen flex items-center justify-center px-6 pt-14">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.8 }}
          >
            <h1 className="text-5xl md:text-7xl tracking-tight mb-6 font-light">
              welcome to a new
              <br />
              <span className="inline-block mt-2">way of reading</span>
            </h1>
          </motion.div>

          <motion.p
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="text-muted-foreground max-w-2xl mx-auto mb-12 text-sm leading-relaxed"
          >
            Textbooks enhanced with local AI inference, contextual explanations, and active recall.
            <br />
            Built for students who think in keystrokes and learn by doing.
          </motion.p>

          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="flex items-center justify-center gap-4"
          >
            <Button
              onClick={() => setShowAuthModal(true)}
              size="lg"
              className="h-11 px-6 text-sm bg-accent hover:bg-accent/90 group"
            >
              Enter Application
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              onClick={onEnterApp}
              variant="outline"
              size="lg"
              className="h-11 px-6 text-sm border-border hover:border-accent/50"
            >
              View Demo
            </Button>
          </motion.div>

          {/* Keyboard hint */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="mt-16 text-xs text-muted-foreground flex items-center justify-center gap-2"
          >
            <kbd className="px-2 py-1 bg-muted rounded border border-border font-mono">j</kbd>
            <kbd className="px-2 py-1 bg-muted rounded border border-border font-mono">k</kbd>
            <span>to navigate</span>
            <span className="mx-2">•</span>
            <kbd className="px-2 py-1 bg-muted rounded border border-border font-mono">n</kbd>
            <span>for notes</span>
            <span className="mx-2">•</span>
            <kbd className="px-2 py-1 bg-muted rounded border border-border font-mono">r</kbd>
            <span>to regenerate</span>
          </motion.div>
        </div>
      </section>

      {/* App Preview */}
      <section className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative"
          >
            {/* Mock interface preview */}
            <div className="bg-card border border-border rounded-lg overflow-hidden shadow-2xl">
              <div className="h-10 border-b border-border flex items-center px-4 gap-2 bg-muted/30">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                </div>
                <div className="flex-1 text-center text-xs text-muted-foreground">
                  ReadAI — Chapter 3: Neural Networks
                </div>
              </div>
              <div className="flex h-[500px]">
                {/* Notes mockup */}
                <div className="w-1/4 border-r border-border bg-card p-4">
                  <div className="space-y-2">
                    <div className="h-3 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-full" />
                    <div className="h-3 bg-muted rounded w-5/6" />
                    <div className="h-6" />
                    <div className="h-3 bg-muted rounded w-2/3" />
                    <div className="h-3 bg-muted rounded w-full" />
                  </div>
                </div>
                {/* Reader mockup */}
                <div className="flex-1 bg-neutral-50 p-8 overflow-hidden">
                  <div className="bg-white h-full rounded shadow-sm p-6 space-y-3">
                    <div className="h-4 bg-foreground/90 rounded w-3/4" />
                    <div className="h-2 bg-foreground/60 rounded w-full" />
                    <div className="h-2 bg-foreground/60 rounded w-full" />
                    <div className="h-2 bg-foreground/60 rounded w-5/6" />
                    <div className="h-4" />
                    <div className="h-2 bg-foreground/60 rounded w-full" />
                    <div className="h-2 bg-foreground/60 rounded w-full" />
                    <div className="h-2 bg-foreground/60 rounded w-4/5" />
                  </div>
                </div>
                {/* AI Panel mockup */}
                <div className="w-1/3 border-l border-border bg-card p-4">
                  <div className="flex gap-4 mb-4 border-b border-border pb-2">
                    <div className="h-2 w-16 bg-accent rounded" />
                    <div className="h-2 w-16 bg-muted rounded" />
                    <div className="h-2 w-16 bg-muted rounded" />
                  </div>
                  <div className="space-y-3">
                    <div className="bg-muted/50 rounded p-2 space-y-1">
                      <div className="h-2 bg-foreground/40 rounded w-full" />
                      <div className="h-2 bg-foreground/40 rounded w-5/6" />
                    </div>
                    <div className="bg-muted/50 rounded p-2 space-y-1">
                      <div className="h-2 bg-foreground/40 rounded w-full" />
                      <div className="h-2 bg-foreground/40 rounded w-4/5" />
                    </div>
                    <div className="bg-muted/50 rounded p-2 space-y-1">
                      <div className="h-2 bg-foreground/40 rounded w-full" />
                      <div className="h-2 bg-foreground/40 rounded w-3/4" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating annotation */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
              className="absolute -left-20 top-1/4 hidden xl:block"
            >
              <div className="text-xs text-muted-foreground text-right">
                <div className="mb-1">Markdown notes</div>
                <div className="w-16 h-px bg-border ml-auto" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
              className="absolute -right-20 top-1/3 hidden xl:block"
            >
              <div className="text-xs text-muted-foreground">
                <div className="w-16 h-px bg-border mb-1" />
                <div>AI summaries</div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-32 px-6 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-20"
          >
            <h2 className="text-3xl tracking-tight mb-4 font-light">Built for speed and depth</h2>
            <p className="text-xs text-muted-foreground tracking-wide uppercase">
              Architecture
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                className="bg-card p-8 hover:bg-muted/30 transition-colors group"
              >
                <feature.icon className="w-5 h-5 text-accent mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="text-sm mb-2">{feature.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 px-6 border-t border-border">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <p className="text-lg text-foreground mb-10 leading-relaxed">
              This is an experiment on a new way of reading. Using AI to accelerate comprehension.
            </p>
            <Button
              onClick={() => setShowAuthModal(true)}
              size="lg"
              className="h-12 px-8 text-sm bg-accent hover:bg-accent/90"
            >
              Create Free Account
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-muted-foreground">
          <div>© 2025 ReadAI. Built for learners.</div>
          <div className="flex gap-6">
            <button className="hover:text-foreground transition-colors">Privacy</button>
            <button className="hover:text-foreground transition-colors">Terms</button>
            <button className="hover:text-foreground transition-colors">Docs</button>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={onEnterApp}
      />
    </div>
  );
}

