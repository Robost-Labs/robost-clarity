-- Multi-Tenancy Migration
-- This migration adds organization support to the Robost Clarity database

-- Enable required extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    domain TEXT UNIQUE NOT NULL,  -- e.g., "acme.com" from user@acme.com
    settings JSONB DEFAULT '{}'::jsonb,  -- Organization-level settings
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_domain ON organizations(domain);

-- Create trigger for organizations updated_at
CREATE TRIGGER update_organizations_updated_at 
    BEFORE UPDATE ON organizations 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add email column to users (for SSO and invitations)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'email') THEN
        ALTER TABLE users ADD COLUMN email TEXT;
    END IF;
END $$;

-- Add organization_id to users table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'organization_id') THEN
        ALTER TABLE users ADD COLUMN organization_id UUID REFERENCES organizations(id);
    END IF;
END $$;

-- Update user role constraint to include new roles
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
    CHECK (role IN ('admin', 'analyst', 'employee', 'read_only'));

-- Add organization_id to llm_requests table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'llm_requests' AND column_name = 'organization_id') THEN
        ALTER TABLE llm_requests ADD COLUMN organization_id UUID REFERENCES organizations(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'llm_requests' AND column_name = 'user_id') THEN
        ALTER TABLE llm_requests ADD COLUMN user_id UUID REFERENCES users(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_llm_requests_org ON llm_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_llm_requests_user ON llm_requests(user_id);

-- Add organization_id to detection_rules table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'detection_rules' AND column_name = 'organization_id') THEN
        ALTER TABLE detection_rules ADD COLUMN organization_id UUID REFERENCES organizations(id);
    END IF;
END $$;

-- Drop unique constraint on name and add composite unique
ALTER TABLE detection_rules DROP CONSTRAINT IF EXISTS detection_rules_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_detection_rules_name_org 
    ON detection_rules(name, organization_id) WHERE organization_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_detection_rules_name_global 
    ON detection_rules(name) WHERE organization_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_detection_rules_org ON detection_rules(organization_id);

-- Add organization_id to alerts table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'alerts' AND column_name = 'organization_id') THEN
        ALTER TABLE alerts ADD COLUMN organization_id UUID REFERENCES organizations(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_alerts_org ON alerts(organization_id);

-- Add organization_id to user_sessions table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_sessions' AND column_name = 'organization_id') THEN
        ALTER TABLE user_sessions ADD COLUMN organization_id UUID REFERENCES organizations(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_sessions' AND column_name = 'user_id') THEN
        ALTER TABLE user_sessions ADD COLUMN user_id UUID REFERENCES users(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_sessions_org ON user_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);

-- Add organization_id to analytics_hourly table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'analytics_hourly' AND column_name = 'organization_id') THEN
        ALTER TABLE analytics_hourly ADD COLUMN organization_id UUID REFERENCES organizations(id);
    END IF;
END $$;

-- Add organization_id to analytics_daily table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'analytics_daily' AND column_name = 'organization_id') THEN
        ALTER TABLE analytics_daily ADD COLUMN organization_id UUID REFERENCES organizations(id);
    END IF;
END $$;

-- Add organization_id to analytics_weekly table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'analytics_weekly' AND column_name = 'organization_id') THEN
        ALTER TABLE analytics_weekly ADD COLUMN organization_id UUID REFERENCES organizations(id);
    END IF;
END $$;

-- Add organization_id to analytics_monthly table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'analytics_monthly' AND column_name = 'organization_id') THEN
        ALTER TABLE analytics_monthly ADD COLUMN organization_id UUID REFERENCES organizations(id);
    END IF;
END $$;

-- Create indexes for analytics tables
CREATE INDEX IF NOT EXISTS idx_analytics_hourly_org ON analytics_hourly(organization_id);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_org ON analytics_daily(organization_id);
CREATE INDEX IF NOT EXISTS idx_analytics_weekly_org ON analytics_weekly(organization_id);
CREATE INDEX IF NOT EXISTS idx_analytics_monthly_org ON analytics_monthly(organization_id);

-- Create unique constraints for per-org analytics
ALTER TABLE analytics_hourly DROP CONSTRAINT IF EXISTS analytics_hourly_time_bucket_provider_model_key;
ALTER TABLE analytics_daily DROP CONSTRAINT IF EXISTS analytics_daily_date_bucket_provider_model_key;
ALTER TABLE analytics_weekly DROP CONSTRAINT IF EXISTS analytics_weekly_week_bucket_provider_model_key;
ALTER TABLE analytics_monthly DROP CONSTRAINT IF EXISTS analytics_monthly_month_bucket_provider_model_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_hourly_time_org 
    ON analytics_hourly(time_bucket, provider, model, organization_id) 
    WHERE organization_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_daily_date_org 
    ON analytics_daily(date_bucket, provider, model, organization_id)
    WHERE organization_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_weekly_week_org 
    ON analytics_weekly(week_bucket, provider, model, organization_id)
    WHERE organization_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_monthly_month_org 
    ON analytics_monthly(month_bucket, provider, model, organization_id)
    WHERE organization_id IS NOT NULL;

-- Add user email index for lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_org 
    ON users(email, organization_id) WHERE email IS NOT NULL;

-- Add list of blocked public email domains to system_settings
INSERT INTO system_settings (key, value, description, category) VALUES
('blocked_email_domains', 'gmail.com,yahoo.com,outlook.com,hotmail.com,aol.com,icloud.com,protonmail.com,mail.com,yandex.com,zoho.com', 
 'Comma-separated list of public email domains that are blocked for signup', 'authentication')
ON CONFLICT (key) DO NOTHING;

-- SSO configuration settings
INSERT INTO system_settings (key, value, description, category) VALUES
('google_sso_enabled', 'false', 'Enable Google Workspace SSO', 'authentication'),
('google_client_id', '', 'Google OAuth2 Client ID', 'authentication'),
('google_client_secret', '', 'Google OAuth2 Client Secret (encrypted)', 'authentication'),
('microsoft_sso_enabled', 'false', 'Enable Microsoft 365 SSO', 'authentication'),
('microsoft_client_id', '', 'Microsoft OAuth2 Client ID', 'authentication'),
('microsoft_client_secret', '', 'Microsoft OAuth2 Client Secret (encrypted)', 'authentication')
ON CONFLICT (key) DO NOTHING;

-- Grant permissions
GRANT ALL PRIVILEGES ON organizations TO robost_user;
