import React, { useState } from 'react';
import { LogIn, LogOut, User, Coins, X, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function AuthButton() {
  const { user, credits, loading, signIn, signUp, signOut } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  if (loading) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
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
  };

  const openModal = (signUp: boolean) => {
    resetForm();
    setIsSignUp(signUp);
    setShowModal(true);
  };

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-sm text-gray-600">
          <Coins className="h-4 w-4 text-[#2d7d7d]" />
          <span className="font-medium">{credits ?? '...'}</span>
          <span className="text-xs text-gray-400">credits</span>
        </div>
        <div className="h-4 w-px bg-gray-200" />
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
