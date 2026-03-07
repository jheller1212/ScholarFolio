import React, { useState } from 'react';
import { Mail, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';

interface EmailCaptureProps {
  onSubmit: (email: string) => Promise<void>;
}

export function EmailCapture({ onSubmit }: EmailCaptureProps) {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    try {
      setLoading(true);
      setError(null);
      await onSubmit(email);
      setSuccess(true);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to subscribe');
    } finally {
      setLoading(false);
    }
  };

  if (step === 2) {
    return (
      <div className="bg-[#eaf4f4] rounded-xl p-6 text-center">
        <div className="w-12 h-12 bg-[#eaf4f4] rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-6 h-6 text-[#2d7d7d]" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Thank You for Subscribing!</h3>
        <p className="text-sm text-gray-700 mb-4">
          Your free guide "Advanced Academic Metrics: A Comprehensive Guide" has been sent to your inbox.
        </p>
        <p className="text-xs text-gray-600">
          Please check your email to confirm your subscription and access your guide.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-[#eaf4f4] to-[#f5f0eb] rounded-xl p-6">
      <div className="flex items-center space-x-3 mb-4">
        <div className="p-2 bg-[#eaf4f4] rounded-lg">
          <Mail className="w-5 h-5 text-[#2d7d7d]" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">
          Get Your Free Guide
        </h3>
      </div>

      <p className="text-sm text-gray-600 mb-6">
        Subscribe to receive "Advanced Academic Metrics: A Comprehensive Guide" and stay updated with the latest in academic analytics.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="sr-only">Email address</label>
          <input
            type="email"
            id="email"
            name="email"
            placeholder="Enter your academic email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2d7d7d] focus:border-transparent transition-all"
            required
          />
        </div>

        {error && (
          <div className="flex items-center space-x-2 text-xs text-red-600">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !email}
          className="w-full bg-[#2d7d7d] text-white px-6 py-2.5 rounded-lg font-medium hover:bg-[#1f5c5c] focus:outline-none focus:ring-2 focus:ring-[#2d7d7d] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <span>Get Free Guide</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        <p className="text-xs text-gray-500 text-center">
          By subscribing, you agree to receive occasional updates about academic analytics.
          You can unsubscribe at any time.
        </p>
      </form>
    </div>
  );
}