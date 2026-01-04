import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import {
    Loader2, Building2, Users, Shield, CheckCircle,
    Copy, RefreshCw, AlertCircle, Mail
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '../components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../components/ui/select';
import { useToast } from '../hooks/use-toast';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const OrganizationSettings = () => {
    const { user, token } = useAuth();
    const { toast } = useToast();

    const [organization, setOrganization] = useState(null);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
    const [inviteForm, setInviteForm] = useState({
        email: '',
        firstName: '',
        lastName: '',
        role: 'employee'
    });
    const [inviteLoading, setInviteLoading] = useState(false);
    const [inviteError, setInviteError] = useState('');
    const [inviteSuccess, setInviteSuccess] = useState(null);

    useEffect(() => {
        fetchOrganization();
        fetchUsers();
    }, []);

    const fetchOrganization = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/organizations/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                setOrganization(data);
            }
        } catch (error) {
            console.error('Failed to fetch organization:', error);
        }
    };

    const fetchUsers = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/organizations/me/users`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                setUsers(data.items || []);
            }
        } catch (error) {
            console.error('Failed to fetch users:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleInviteSubmit = async (e) => {
        e.preventDefault();
        setInviteLoading(true);
        setInviteError('');
        setInviteSuccess(null);

        try {
            const response = await fetch(`${API_BASE_URL}/users/invite`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: inviteForm.email,
                    first_name: inviteForm.firstName,
                    last_name: inviteForm.lastName,
                    role: inviteForm.role
                })
            });

            const data = await response.json();

            if (response.ok) {
                setInviteSuccess(data);
                fetchUsers(); // Refresh user list
                toast({
                    title: "User Invited",
                    description: `Invitation sent to ${inviteForm.email}`,
                });
            } else {
                setInviteError(data.detail || 'Failed to invite user');
            }
        } catch (error) {
            setInviteError('Network error. Please try again.');
        } finally {
            setInviteLoading(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        toast({
            title: "Copied!",
            description: "Temporary password copied to clipboard",
        });
    };

    const getRoleBadgeVariant = (role) => {
        switch (role) {
            case 'admin': return 'destructive';
            case 'analyst': return 'default';
            case 'viewer': return 'secondary';
            case 'employee': return 'outline';
            default: return 'outline';
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Organization Settings</h2>
                <p className="text-muted-foreground">
                    Manage your organization and team members
                </p>
            </div>

            {/* Organization Info Card */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        <CardTitle>Organization Details</CardTitle>
                    </div>
                    <CardDescription>
                        Basic information about your organization
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {organization ? (
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <Label className="text-muted-foreground">Organization Name</Label>
                                <p className="text-lg font-medium">{organization.name}</p>
                            </div>
                            <div>
                                <Label className="text-muted-foreground">Domain</Label>
                                <p className="text-lg font-medium">{organization.domain}</p>
                            </div>
                            <div>
                                <Label className="text-muted-foreground">Total Users</Label>
                                <p className="text-lg font-medium">{organization.user_count || 0}</p>
                            </div>
                            <div>
                                <Label className="text-muted-foreground">Created</Label>
                                <p className="text-lg font-medium">
                                    {new Date(organization.created_at).toLocaleDateString()}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <p className="text-muted-foreground">Organization information not available</p>
                    )}
                </CardContent>
            </Card>

            {/* Team Members Card */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-primary" />
                            <CardTitle>Team Members</CardTitle>
                        </div>
                        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                            <DialogTrigger asChild>
                                <Button>
                                    <Mail className="mr-2 h-4 w-4" />
                                    Invite User
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Invite Team Member</DialogTitle>
                                    <DialogDescription>
                                        Send an invitation to add a new user to your organization
                                    </DialogDescription>
                                </DialogHeader>

                                {inviteSuccess ? (
                                    <div className="space-y-4">
                                        <Alert>
                                            <CheckCircle className="h-4 w-4" />
                                            <AlertDescription>
                                                User <strong>{inviteSuccess.user.email}</strong> has been invited!
                                            </AlertDescription>
                                        </Alert>
                                        <div className="p-4 bg-muted rounded-lg space-y-2">
                                            <p className="text-sm font-medium">Temporary Password:</p>
                                            <div className="flex items-center gap-2">
                                                <code className="px-2 py-1 bg-background rounded">
                                                    {inviteSuccess.temp_password}
                                                </code>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => copyToClipboard(inviteSuccess.temp_password)}
                                                >
                                                    <Copy className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                Share this password securely. User should change it on first login.
                                            </p>
                                        </div>
                                        <Button
                                            onClick={() => {
                                                setInviteSuccess(null);
                                                setInviteForm({ email: '', firstName: '', lastName: '', role: 'employee' });
                                                setInviteDialogOpen(false);
                                            }}
                                            className="w-full"
                                        >
                                            Done
                                        </Button>
                                    </div>
                                ) : (
                                    <form onSubmit={handleInviteSubmit} className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="firstName">First Name</Label>
                                                <Input
                                                    id="firstName"
                                                    value={inviteForm.firstName}
                                                    onChange={(e) => setInviteForm({ ...inviteForm, firstName: e.target.value })}
                                                    required
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="lastName">Last Name</Label>
                                                <Input
                                                    id="lastName"
                                                    value={inviteForm.lastName}
                                                    onChange={(e) => setInviteForm({ ...inviteForm, lastName: e.target.value })}
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="email">Email</Label>
                                            <Input
                                                id="email"
                                                type="email"
                                                value={inviteForm.email}
                                                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                                                placeholder="user@company.com"
                                                required
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="role">Role</Label>
                                            <Select
                                                value={inviteForm.role}
                                                onValueChange={(value) => setInviteForm({ ...inviteForm, role: value })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select role" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="admin">Admin - Full access</SelectItem>
                                                    <SelectItem value="analyst">Analyst - Read + analyze</SelectItem>
                                                    <SelectItem value="viewer">Viewer - Read only (console)</SelectItem>
                                                    <SelectItem value="employee">Employee - Extension only</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {inviteError && (
                                            <Alert variant="destructive">
                                                <AlertCircle className="h-4 w-4" />
                                                <AlertDescription>{inviteError}</AlertDescription>
                                            </Alert>
                                        )}

                                        <Button type="submit" className="w-full" disabled={inviteLoading}>
                                            {inviteLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            {inviteLoading ? 'Sending Invite...' : 'Send Invite'}
                                        </Button>
                                    </form>
                                )}
                            </DialogContent>
                        </Dialog>
                    </div>
                    <CardDescription>
                        Manage who has access to your organization
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {users.length > 0 ? (
                            <div className="divide-y">
                                {users.map((u) => (
                                    <div key={u.id} className="flex items-center justify-between py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                                <span className="text-sm font-medium text-primary">
                                                    {(u.first_name?.[0] || u.email?.[0] || 'U').toUpperCase()}
                                                </span>
                                            </div>
                                            <div>
                                                <p className="font-medium">
                                                    {u.first_name} {u.last_name}
                                                </p>
                                                <p className="text-sm text-muted-foreground">{u.email || u.username}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant={getRoleBadgeVariant(u.role)}>
                                                {u.role}
                                            </Badge>
                                            {!u.is_active && (
                                                <Badge variant="outline" className="text-yellow-600">
                                                    Inactive
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center text-muted-foreground py-8">
                                No team members found. Invite your first user!
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Chrome Extension Card */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-primary" />
                        <CardTitle>Chrome Extension</CardTitle>
                    </div>
                    <CardDescription>
                        Deploy the Robost Clarity extension to monitor LLM usage
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            The Chrome extension intercepts and monitors LLM traffic from your employees' browsers.
                            Users can log in with their organization credentials.
                        </p>
                        <div className="flex gap-2">
                            <Button variant="outline">
                                Download Extension
                            </Button>
                            <Button variant="outline">
                                View Documentation
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default OrganizationSettings;
