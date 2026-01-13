import React, { useState, useEffect } from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { PasswordInput } from '../components/ui/password-input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Loader2, Shield, AlertCircle } from 'lucide-react';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [googleError, setGoogleError] = useState('');

  const { login, loginWithGoogle, isAuthenticated } = useAuth();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/dashboard';

  // Redirect if already authenticated
  if (isAuthenticated()) {
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(username, password);

      if (result.success) {
        // Redirect handled by Navigate above after auth state updates
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    setGoogleError('');
    try {
      const result = await loginWithGoogle(credentialResponse.credential);
      if (!result.success) {
        setGoogleError(result.error);
      }
    } catch (err) {
      setGoogleError('Google login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setGoogleError('Google login was unsuccessful');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex flex-col items-center mb-4">
            <Shield className="h-12 w-12 text-primary mb-2" />
          </div>
          <CardTitle className="text-2xl font-bold">Robost Clarity</CardTitle>
          <CardDescription>
            Sign in to access the monitoring dashboard
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username or Email</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username or email"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                disabled={loading}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? 'Signing In...' : 'Sign In'}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>

            <div className="flex justify-center w-full">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                theme="filled_blue"
                width="350"
                text="signin_with"
                shape="pill"
              />
            </div>

            {googleError && (
              <Alert variant="destructive" className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{googleError}</AlertDescription>
              </Alert>
            )}
          </form>

          {/* Signup Link */}
          <div className="mt-6 text-center text-sm text-muted-foreground">
            Don't have an organization?{' '}
            <Link to="/signup" className="text-primary hover:underline font-medium">
              Create one
            </Link>
          </div>


        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;