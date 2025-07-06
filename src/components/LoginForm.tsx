import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Mail, Lock, AlertCircle, Database, Wifi, WifiOff } from 'lucide-react';
import { isSupabaseConfigured } from '../lib/supabase';

const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const demoUsers = [
    { email: 'john@company.com', role: 'Client Manager' },
    { email: 'sarah@company.com', role: 'Client Architect' },
    { email: 'mike@stratifyit.ai', role: 'Admin Consultant' },
    { email: 'lisa@stratifyit.ai', role: 'Admin Architect' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Shield className="mx-auto h-12 w-12 text-blue-600" />
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Welcome to StratifyIT.ai
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            IT Portfolio Assessment & Analysis Platform
          </p>
          
          {/* Database Connection Status */}
          <div className="mt-4 flex items-center justify-center">
            {isSupabaseConfigured() ? (
              <div className="flex items-center space-x-2 px-3 py-1 bg-green-50 border border-green-200 rounded-full">
                <Wifi className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">Database Connected</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 px-3 py-1 bg-orange-50 border border-orange-200 rounded-full">
                <WifiOff className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium text-orange-800">Demo Mode</span>
              </div>
            )}
          </div>
        </div>

        {/* Supabase Configuration Notice */}
        {!isSupabaseConfigured() && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Database className="h-5 w-5 text-amber-500 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-amber-800">Database Setup Required</h3>
                <p className="text-sm text-amber-700 mt-1">
                  To connect to your Supabase database, update the .env file with your project credentials.
                </p>
              </div>
            </div>
          </div>
        )}

        <form className="mt-8 space-y-6 bg-white p-8 rounded-lg shadow-md" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <span className="text-sm text-red-800">{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <div className="mt-1 relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1 relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your password"
                  required
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        {!isSupabaseConfigured() && (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Demo Accounts</h3>
            <div className="space-y-2">
              {demoUsers.map((user) => (
                <button
                  key={user.email}
                  onClick={() => {
                    setEmail(user.email);
                    setPassword('demo123');
                  }}
                  className="w-full text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                >
                  <div className="font-medium text-gray-900">{user.email}</div>
                  <div className="text-sm text-gray-600">{user.role}</div>
                </button>
              ))}
            </div>
            <p className="mt-4 text-xs text-gray-500">
              Click any demo account to auto-fill credentials (password: demo123)
            </p>
          </div>
        )}

        {isSupabaseConfigured() && (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Database Connected</h3>
            <p className="text-sm text-gray-600">
              You can now sign up for a new account or sign in with existing credentials.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginForm;