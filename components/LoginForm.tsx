import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, AlertCircle, User as UserIcon, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface LoginFormProps {
  onLoginSuccess?: () => void;
  isLoading?: boolean;
  error?: string;
}

export const LoginForm: React.FC<LoginFormProps> = ({ 
  onLoginSuccess, 
  isLoading = false,
  error = null
}) => {
  const { login, signup, resetPassword, isLoading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [isSignupAllowed, setIsSignupAllowed] = useState(false);
  const [isReset, setIsReset] = useState(false);
  const [localError, setLocalError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Check for signup mode in URL
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'signup') {
      setIsSignup(true);
      setIsSignupAllowed(true);
      const emailParam = params.get('email');
      if (emailParam) setEmail(emailParam);
      const nameParam = params.get('name');
      if (nameParam) setName(nameParam);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    setSuccessMessage('');

    try {
      if (isReset) {
        if (!email) {
          setLocalError('Please enter your email address');
          return;
        }
        await resetPassword(email);
        setSuccessMessage('Password reset email sent! Please check your inbox.');
        setTimeout(() => setIsReset(false), 5000);
      } else if (isSignup) {
        if (!name.trim()) {
          setLocalError('Please enter your name');
          return;
        }
        console.log('LoginForm: Initiating signup for', email);
        await signup(email, password, name);
        console.log('LoginForm: Signup successful');
      } else {
        console.log('LoginForm: Initiating login for', email);
        await login(email, password);
        console.log('LoginForm: Login successful');
      }
      if (!isReset) onLoginSuccess?.();
    } catch (err: any) {
      console.error('LoginForm error:', err.code, err.message, err);
      if (err.code === 'auth/email-already-in-use') {
        setLocalError('You already have an account. Please login using your email and password.');
        setTimeout(() => {
          setIsSignup(false);
          setLocalError('');
          // Clear password but keep email for easier login
          setPassword('');
        }, 4000);
      } else {
        const errorMessage = err.message || 'Authentication failed';
        setLocalError(errorMessage);
      }
    }
  };

  if (isReset) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="bg-white p-3 rounded-lg shadow-lg">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded flex items-center justify-center">
                  <span className="text-white font-bold text-sm">📦</span>
                </div>
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white mb-1">ShipMaster</h1>
            <p className="text-indigo-200">Reset Password</p>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-1">Forgot Password?</h2>
            <p className="text-sm text-slate-500 mb-6">Enter your email address and we'll send you a link to reset your password.</p>

            {localError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                <AlertCircle size={18} className="text-red-600" />
                <p className="text-sm text-red-700">{localError}</p>
              </div>
            )}

            {successMessage && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                <CheckCircle2 size={18} className="text-green-600" />
                <p className="text-sm text-green-700">{successMessage}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                    required
                    disabled={authLoading}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-2 rounded-lg transition mt-6"
              >
                {authLoading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>

            <div className="mt-6 text-center text-sm">
              <button
                onClick={() => setIsReset(false)}
                className="text-indigo-600 hover:text-indigo-700 font-semibold"
              >
                Back to Sign In
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        
        {/* Logo Section */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-white p-3 rounded-lg shadow-lg">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded flex items-center justify-center">
                <span className="text-white font-bold text-sm">📦</span>
              </div>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">ShipMaster</h1>
          <p className="text-indigo-200">FedEx Enterprise Portal</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          
          {/* Heading */}
          <h2 className="text-2xl font-bold text-slate-900 mb-1">
            {isSignup ? 'Create Account' : 'Welcome Back'}
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            {isSignup 
              ? 'Sign up for a new account' 
              : 'Sign in to your account to continue'}
          </p>

            {/* Error Message */}
            {(localError || error) && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                <AlertCircle size={18} className="text-red-600" />
                <p className="text-sm text-red-700">{localError || error}</p>
              </div>
            )}

            {successMessage && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                <CheckCircle2 size={18} className="text-green-600" />
                <p className="text-sm text-green-700">{successMessage}</p>
              </div>
            )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name Field - Only show on signup */}
            {isSignup && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon size={18} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                    required={isSignup}
                    disabled={authLoading}
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-3 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                  required
                  disabled={authLoading}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-3 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                  required
                  disabled={authLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {!isSignup && (
                <div className="flex justify-end mt-1">
                  <button
                    type="button"
                    onClick={() => setIsReset(true)}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    Forgot password?
                  </button>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-2 rounded-lg transition mt-6"
            >
              {authLoading ? 'Loading...' : isSignup ? 'Sign Up' : 'Sign In'}
            </button>
          </form>

          {/* Toggle Signup/Login */}
          {(isSignup || isSignupAllowed) && (
            <div className="mt-6 text-center text-sm">
              <p className="text-slate-600">
                {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button
                  onClick={() => {
                    setIsSignup(!isSignup);
                    setLocalError('');
                    setName('');
                    setEmail('');
                    setPassword('');
                  }}
                  className="text-indigo-600 hover:text-indigo-700 font-semibold"
                >
                  {isSignup ? 'Sign In' : 'Sign Up'}
                </button>
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-indigo-200 text-xs mt-8">
          &copy; {new Date().getFullYear()} ShipMaster. All rights reserved.
        </p>
      </div>
    </div>
  );
};