import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../utils';
import {
  LayoutDashboard,
  Database,
  AlertTriangle,
  Users,
  Activity,
  Shield,
  Settings,
  Bell,
  Target,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Building
} from 'lucide-react';

const sidebarSections = [
  {
    title: 'Activity',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'LLM Requests', href: '/requests', icon: Database },
      { name: 'Flagged Prompts', href: '/flagged', icon: AlertTriangle },
      { name: 'Sessions', href: '/sessions', icon: Users },
      { name: 'Live Feed', href: '/live', icon: Activity }
    ]
  },
  {
    title: 'Intelligence',
    items: [
      { name: 'Detection Rules', href: '/rules', icon: Shield, adminOnly: true },
      { name: 'Alerts', href: '/alerts', icon: Bell },
      { name: 'Analytics', href: '/analytics', icon: BarChart3 }
    ]
  },
  {
    title: 'Administration',
    items: [
      { name: 'User Management', href: '/users', icon: Users, adminOnly: true },
      { name: 'Organization', href: '/organization', icon: Building, adminOnly: true },
      { name: 'System Settings', href: '/settings', icon: Settings, adminOnly: true }
    ]
  }
];

const SidebarItem = ({ item, isActive, onClick, isCollapsed }) => {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.href}
      className={({ isActive }) =>
        cn(
          "flex items-center px-3 py-1.5 rounded-lg sidebar-link-text transition-all duration-200 group touch-manipulation min-h-[44px]",
          isActive
            ? "bg-teal-50 text-teal-700"
            : "text-main hover:text-gray-900 hover:bg-gray-100",
          isCollapsed ? "justify-center" : ""
        )
      }
      onClick={onClick}
      title={isCollapsed ? item.name : undefined}
    >
      <Icon className={cn(
        "h-5 w-5 transition-colors",
        isActive ? "text-teal-600" : "text-gray-400 group-hover:text-gray-600",
        isCollapsed ? "mr-0" : "mr-3"
      )} />
      {!isCollapsed && item.name}
    </NavLink>
  );
};

const Sidebar = ({ isOpen = true, onClose, isMobile = false }) => {
  const { isAdmin } = useAuth();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Close sidebar when clicking on a link on mobile
  const handleLinkClick = () => {
    if (isMobile && onClose) {
      onClose();
    }
  };

  // Toggle collapsed state (only on desktop)
  const toggleCollapse = () => {
    if (!isMobile) {
      setIsCollapsed(!isCollapsed);
    }
  };

  return (
    <div
      className={`
        ${isMobile ? 'fixed' : 'relative'} 
        ${isMobile ? (isOpen ? 'translate-x-0' : '-translate-x-full') : ''}
        ${isCollapsed ? 'w-20' : 'w-64'} bg-white h-full border-r border-gray-200 z-50 transition-all duration-300 ease-in-out
        ${isMobile ? 'md:relative md:translate-x-0' : ''}
      `}
    >
      {/* Logo */}
      <div className={cn("py-5", isCollapsed ? "flex justify-center" : "px-6")}>
        {isCollapsed ? (
          <NavLink
            to="/dashboard"
            onClick={handleLinkClick}
            className="flex items-center justify-center py-3 hover:bg-gray-50 transition-colors w-full"
          >
            <img
              src="/favicon.ico"
              alt="Icon"
              className="h-9 w-9"
            />
          </NavLink>
        ) : (
          <NavLink
            to="/dashboard"
            onClick={handleLinkClick}
            className="flex items-center px-4 py-3 hover:bg-gray-50 transition-colors"
          >
            <img
              src="/favicon.ico"
              alt="Icon"
              className="h-9 w-9 mr-3"
            />
            <span className="text-2xl font-bold text-teal-600" style={{ fontFamily: 'Inter, sans-serif' }}>
              Robost
            </span>
          </NavLink>
        )}
      </div>

      {/* Toggle Button */}
      {!isMobile && (
        <div className="absolute -right-3 top-24 z-10">
          <button
            onClick={toggleCollapse}
            className="flex items-center justify-center w-6 h-6 bg-white border border-gray-300 rounded-full shadow-sm hover:bg-gray-50 transition-colors"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-3 w-3 text-gray-600" />
            ) : (
              <ChevronLeft className="h-3 w-3 text-gray-600" />
            )}
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className={cn("flex-1 px-4 py-6 space-y-8", isCollapsed ? "px-2" : "")}>
        {sidebarSections.map((section) => (
          <div key={section.title}>
            {!isCollapsed && (
              <h3 className="px-3 mb-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                {section.title}
              </h3>
            )}
            <div className={cn("space-y-0", isCollapsed ? "space-y-2" : "")}>
              {section.items
                .filter(item => !item.adminOnly || isAdmin())
                .map((item) => (
                  <SidebarItem
                    key={item.name}
                    item={item}
                    isActive={location.pathname === item.href}
                    onClick={handleLinkClick}
                    isCollapsed={isCollapsed}
                  />
                ))}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
};

export default Sidebar;