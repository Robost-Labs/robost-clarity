import React, { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { PasswordInput } from '../components/ui/password-input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Loader2, AlertCircle, CheckCircle2, Building2 } from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const SignupPage = () => {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        organizationName: '',
        firstName: '',
        lastName: ''
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    const { isAuthenticated, setAuth } = useAuth();

    // Redirect if already authenticated
    if (isAuthenticated()) {
        return <Navigate to="/dashboard" replace />;
    }

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setError('');
    };

    const validateForm = () => {
        if (!formData.email || !formData.password || !formData.organizationName ||
            !formData.firstName || !formData.lastName) {
            setError('All fields are required');
            return false;
        }

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return false;
        }

        if (formData.password.length < 8) {
            setError('Password must be at least 8 characters');
            return false;
        }

        // Check for business email
        const publicDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aol.com'];
        const domain = formData.email.split('@')[1]?.toLowerCase();
        if (publicDomains.includes(domain)) {
            setError('Please use your business email address');
            return false;
        }

        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) return;

        setError('');
        setLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/auth/signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: formData.email,
                    password: formData.password,
                    organization_name: formData.organizationName,
                    first_name: formData.firstName,
                    last_name: formData.lastName
                }),
            });

            const data = await response.json();

            if (response.ok) {
                // Auto-login with returned token
                if (data.access_token) {
                    localStorage.setItem('token', data.access_token);
                    localStorage.setItem('user', JSON.stringify({
                        username: data.user.email,
                        role: data.user.role,
                        firstName: data.user.first_name,
                        lastName: data.user.last_name,
                        organizationId: data.organization.id,
                        organizationName: data.organization.name
                    }));
                    setSuccess(true);
                    // Redirect after brief success message
                    setTimeout(() => {
                        window.location.href = '/dashboard';
                    }, 1500);
                }
            } else {
                setError(data.detail || 'Signup failed. Please try again.');
            }
        } catch (err) {
            setError('Network error. Please check your connection.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/30">
                <Card className="w-full max-w-md">
                    <CardContent className="pt-6">
                        <div className="flex flex-col items-center text-center space-y-4">
                            <CheckCircle2 className="h-16 w-16 text-green-500" />
                            <h2 className="text-2xl font-bold">Welcome to Robost Clarity!</h2>
                            <p className="text-muted-foreground">
                                Your organization has been created successfully. Redirecting to dashboard...
                            </p>
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/30 py-8">
            <Card className="w-full max-w-md mx-4">
                <CardHeader className="text-center">
                    <div className="flex flex-col items-center mb-4">
                        <Building2 className="h-12 w-12 text-primary mb-2" />
                    </div>
                    <CardTitle className="text-2xl font-bold">Create Your Organization</CardTitle>
                    <CardDescription>
                        Start monitoring your organization's LLM usage
                    </CardDescription>
                </CardHeader>

                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Organization Name */}
                        <div className="space-y-2">
                            <Label htmlFor="organizationName">Organization Name</Label>
                            <Input
                                id="organizationName"
                                name="organizationName"
                                type="text"
                                value={formData.organizationName}
                                onChange={handleChange}
                                placeholder="Acme Inc."
                                required
                                disabled={loading}
                            />
                        </div>

                        {/* Name Fields */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="firstName">First Name</Label>
                                <Input
                                    id="firstName"
                                    name="firstName"
                                    type="text"
                                    value={formData.firstName}
                                    onChange={handleChange}
                                    placeholder="John"
                                    required
                                    disabled={loading}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lastName">Last Name</Label>
                                <Input
                                    id="lastName"
                                    name="lastName"
                                    type="text"
                                    value={formData.lastName}
                                    onChange={handleChange}
                                    placeholder="Doe"
                                    required
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        {/* Email */}
                        <div className="space-y-2">
                            <Label htmlFor="email">Business Email</Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="you@yourcompany.com"
                                required
                                disabled={loading}
                            />
                            <p className="text-xs text-muted-foreground">
                                Use your work email (public domains like Gmail are not allowed)
                            </p>
                        </div>

                        {/* Password */}
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <PasswordInput
                                id="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="Minimum 8 characters"
                                required
                                disabled={loading}
                            />
                        </div>

                        {/* Confirm Password */}
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirm Password</Label>
                            <PasswordInput
                                id="confirmPassword"
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                placeholder="Confirm your password"
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
                            {loading ? 'Creating Organization...' : 'Create Organization'}
                        </Button>
                    </form>

                    <div className="mt-6 text-center text-sm text-muted-foreground">
                        Already have an account?{' '}
                        <Link to="/login" className="text-primary hover:underline font-medium">
                            Sign in
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default SignupPage;
