import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Mail, Lock, AlertCircle, Building } from 'lucide-react';
import { isSupabaseConfigured } from '../lib/supabase';

const LoginForm: React.FC = () => {
  const [orgCode, setOrgCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validate organization code length
    if (orgCode.length !== 5) {
      setError('Organization code must be exactly 5 characters');
      setLoading(false);
      return;
    }

    // Validate organization code format (alphanumeric)
    if (!/^[A-Z0-9]{5}$/.test(orgCode.toUpperCase())) {
      setError('Organization code must be 5 alphanumeric characters');
      setLoading(false);
      return;
    }

    try {
      await login(orgCode, email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const demoUsers = [
    { orgCode: 'TECH1', email: 'john@company.com', role: 'Client Manager' },
    { orgCode: 'TECH1', email: 'sarah@company.com', role: 'Client Architect' },
    { orgCode: 'STRAT', email: 'mike@stratifyit.ai', role: 'Admin Consultant' },
    { orgCode: 'STRAT', email: 'lisa@stratifyit.ai', role: 'Admin Architect' }
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
        </div>

        <form className="mt-8 space-y-6 bg-white p-8 rounded-lg shadow-md" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <span className="text-sm text-red-800">{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="orgCode" className="block text-sm font-medium text-gray-700">
                Organization Code
              </label>
              <div className="mt-1 relative">
                <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="orgCode"
                  type="text"
                  value={orgCode}
                  onChange={(e) => setOrgCode(e.target.value.toUpperCase())}
                  className="pl-10 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., TECH1, STRAT"
                  maxLength={5}
                  required
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                5-character alphanumeric code (e.g., TECH1, STRAT, DEMO1)
              </p>
            </div>

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
                    setOrgCode(user.orgCode);
                    setEmail(user.email);
                    setPassword('demo123');
                  }}
                  className="w-full text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                >
                  <div className="font-medium text-gray-900">{user.email}</div>
                  <div className="text-sm text-gray-600">{user.role} • {user.orgCode}</div>
                </button>
              ))}
            </div>
            <p className="mt-4 text-xs text-gray-500">
              Click any demo account to auto-fill credentials (password: demo123)
            </p>
            <p className="mt-2 text-xs text-gray-500">
              Organization codes: TECH1 (TechCorp), STRAT (StratifyIT.ai)
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginForm;