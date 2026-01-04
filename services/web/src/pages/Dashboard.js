import React, { useState, useEffect, useCallback } from 'react';
import { requestsService } from '../services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { MetricCard } from '../components/ui/metric-card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { SkeletonDashboard } from '../components/ui/skeleton';
import { AutoRefreshToggle } from '../components/ui/auto-refresh-toggle';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { AlertCircle, Database, AlertTriangle, TrendingUp, Users } from 'lucide-react';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [recentRequests, setRecentRequests] = useState([]);
  const [statsDays, setStatsDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch statistics
      const statsResponse = await requestsService.getStats(statsDays);
      setStats(statsResponse.data);
      
      // Fetch recent requests
      const requestsResponse = await requestsService.getRequests({
        page: 1,
        page_size: 10
      });
      setRecentRequests(requestsResponse.data.items);
      
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [statsDays]);


  // Auto-refresh setup
  const autoRefresh = useAutoRefresh({
    fetchFunction: fetchDashboardData,
    defaultInterval: 30000, // 30 seconds
    defaultEnabled: false
  });

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const hasRecentRequests = recentRequests.length > 0;
  const selectedWindowMs = statsDays * 24 * 60 * 60 * 1000;
  const cutoffTimestamp = Date.now() - selectedWindowMs;
  const hasActivityOutsideWindow = hasRecentRequests && recentRequests.some((r) => {
    const ts = new Date(r.timestamp).getTime();
    return Number.isFinite(ts) && ts < cutoffTimestamp;
  });

  const formatNumber = (num) => {
    return num?.toLocaleString() || 0;
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  if (loading) {
    return <SkeletonDashboard />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-13 text-gray-600">
            Overview of LLM traffic monitoring and detection activity
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant={statsDays === 30 ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatsDays(30)}
            >
              30d
            </Button>
            <Button
              variant={statsDays === 90 ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatsDays(90)}
            >
              90d
            </Button>
            <Button
              variant={statsDays === 365 ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatsDays(365)}
            >
              365d
            </Button>
          </div>

          <AutoRefreshToggle
            isEnabled={autoRefresh.isEnabled}
            interval={autoRefresh.interval}
            onToggle={autoRefresh.toggleAutoRefresh}
            onIntervalChange={autoRefresh.updateInterval}
            onManualRefresh={autoRefresh.manualRefresh}
            lastRefresh={autoRefresh.lastRefresh}
            compact={true}
          />
        </div>
      </div>

      {stats?.total_requests === 0 && hasRecentRequests && hasActivityOutsideWindow && (
        <Alert>
          <AlertDescription>
            No requests in the selected time range. Recent activity exists outside the last {statsDays} days.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard variant="blue">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-medium text-gray-700">{formatNumber(stats?.total_requests)}</div>
            <p className="text-xs text-muted-foreground">Last {statsDays} days</p>
          </CardContent>
        </MetricCard>

        <MetricCard variant="red">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Flagged Requests</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-medium text-gray-700">{formatNumber(stats?.flagged_requests)}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.flagged_rate}% flag rate
            </p>
          </CardContent>
        </MetricCard>

        <MetricCard variant="orange">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Risk Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-medium text-gray-700">{stats?.avg_risk_score}</div>
            <p className="text-xs text-muted-foreground">0-100 scale</p>
          </CardContent>
        </MetricCard>

        <MetricCard variant="green">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique IPs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-medium text-gray-700">{stats?.top_risk_ips?.length || 0}</div>
            <p className="text-xs text-muted-foreground">With flagged requests</p>
          </CardContent>
        </MetricCard>
      </div>

      {/* Top Providers and Models */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top Providers</CardTitle>
            <CardDescription>Most used LLM providers (last 30 days)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats?.top_providers?.map((provider, index) => (
                <div key={provider.provider} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-13 font-medium text-main">{provider.provider}</span>
                  </div>
                  <Badge variant="secondary">{formatNumber(provider.count)}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Models</CardTitle>
            <CardDescription>Most used LLM models (last 30 days)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats?.top_models?.map((model, index) => (
                <div key={model.model} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-secondary" />
                    <span className="text-13 font-medium text-main">{model.model}</span>
                  </div>
                  <Badge variant="secondary">{formatNumber(model.count)}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest LLM requests</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentRequests.map((request) => (
              <div key={request.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="flex flex-col">
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">{request.provider}</Badge>
                      <Badge variant="secondary">{request.model}</Badge>
                      {request.is_flagged && (
                        <Badge variant="destructive">Flagged</Badge>
                      )}
                    </div>
                    <p className="text-13 text-muted-foreground mt-1">
                      {request.src_ip} • {formatTimestamp(request.timestamp)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant={request.risk_score >= 70 ? 'destructive' : request.risk_score >= 40 ? 'secondary' : 'default'}>
                    Risk: {request.risk_score}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

    </div>
  );
};

export default Dashboard;