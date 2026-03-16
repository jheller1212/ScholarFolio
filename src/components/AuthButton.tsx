import React, { useState } from 'react';
import { LogIn, LogOut, User, X, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function AuthButton() {
  const { user, credits, loading, signIn, signUp, signInWithGoogle, signOut } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  if (loading) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (isSignUp && !agreedToTerms) {
        setError('Please agree to the Terms of Use to continue.');
        setSubmitting(false);
        return;
      }
      if (isSignUp) {
        const { error } = await signUp(email, password);
        if (error) {
          setError(error);
        } else {
          setConfirmSent(true);
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          setError(error);
        } else {
          setShowModal(false);
          resetForm();
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setError(null);
    setConfirmSent(false);
    setShowPassword(false);
    setAgreedToTerms(false);
  };

  const openModal = (signUp: boolean) => {
    resetForm();
    setIsSignUp(signUp);
    setShowModal(true);
  };

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <User className="h-3.5 w-3.5" />
          <span className="max-w-[120px] truncate">{user.email}</span>
        </div>
        <button
          onClick={signOut}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={() => openModal(false)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#2d7d7d] hover:bg-[#eaf4f4] rounded-lg transition-colors"
        >
          <LogIn className="h-3.5 w-3.5" />
          Sign in
        </button>
        <button
          onClick={() => openModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#2d7d7d] hover:bg-[#1f5c5c] rounded-lg transition-colors"
        >
          Sign up
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                {isSignUp ? 'Create account' : 'Sign in'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Terms agreement for sign-up */}
            {isSignUp && (
              <label className="flex items-start gap-2 text-xs text-gray-600 mb-1">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={e => setAgreedToTerms(e.target.checked)}
                  className="mt-0.5 rounded border-gray-300 text-[#2d7d7d] focus:ring-[#2d7d7d]"
                />
                <span>
                  I agree to the{' '}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-[#2d7d7d] hover:underline">
                    Terms of Use
                  </a>
                  {' '}and{' '}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-[#2d7d7d] hover:underline">
                    Privacy Policy
                  </a>.
                  Scholar Folio is not intended for ranking or evaluating researchers.
                </span>
              </label>
            )}

            {/* Google sign-in */}
            <button
              onClick={async () => {
                if (isSignUp && !agreedToTerms) {
                  setError('Please agree to the Terms of Use to continue.');
                  return;
                }
                const { error } = await signInWithGoogle();
                if (error) setError(error);
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-3 my-1">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">or</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {confirmSent ? (
              <div className="text-center py-4">
                <div className="w-12 h-12 bg-[#eaf4f4] rounded-full flex items-center justify-center mx-auto mb-3">
                  <User className="h-6 w-6 text-[#2d7d7d]" />
                </div>
                <p className="text-sm text-gray-700 mb-1">Check your email</p>
                <p className="text-xs text-gray-500">
                  We sent a confirmation link to <strong>{email}</strong>
                </p>
                <button
                  onClick={() => setShowModal(false)}
                  className="mt-4 px-4 py-2 text-sm bg-[#2d7d7d] text-white rounded-lg hover:bg-[#1f5c5c]"
                >
                  Got it
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2d7d7d]/20 focus:border-[#2d7d7d]"
                    placeholder="you@university.edu"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full px-3 py-2 pr-10 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2d7d7d]/20 focus:border-[#2d7d7d]"
                      placeholder="Min 6 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2 text-sm font-medium text-white bg-[#2d7d7d] rounded-lg hover:bg-[#1f5c5c] disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Please wait...' : isSignUp ? 'Create account' : 'Sign in'}
                </button>

                {isSignUp && (
                  <p className="text-xs text-center text-gray-500">
                    You'll receive <strong>5 additional free searches</strong> on top of your guest searches.
                  </p>
                )}

                <p className="text-xs text-center text-gray-500">
                  {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                  <button
                    type="button"
                    onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
                    className="text-[#2d7d7d] hover:underline font-medium"
                  >
                    {isSignUp ? 'Sign in' : 'Sign up'}
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
