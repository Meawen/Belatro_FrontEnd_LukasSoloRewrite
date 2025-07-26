
import React, { useState, useEffect } from 'react';
import { Button } from '../common';

interface SystemHealth {
    database: 'healthy' | 'warning' | 'error';
    api: 'healthy' | 'warning' | 'error';
    websocket: 'healthy' | 'warning' | 'error';
}

export const SystemStatus: React.FC = () => {
    const [systemHealth, setSystemHealth] = useState<SystemHealth>({
        database: 'healthy',
        api: 'healthy',
        websocket: 'healthy'
    });
    const [lastChecked, setLastChecked] = useState<Date>(new Date());

    // Mock system health check
    const checkSystemHealth = () => {
        // In a real app, you'd make actual health check API calls
        setSystemHealth({
            database: 'healthy',
            api: 'healthy',
            websocket: 'healthy'
        });
        setLastChecked(new Date());
    };

    useEffect(() => {
        checkSystemHealth();
        const interval = setInterval(checkSystemHealth, 60000); // Check every minute
        return () => clearInterval(interval);
    }, []);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'healthy': return 'text-green-400';
            case 'warning': return 'text-yellow-400';
            case 'error': return 'text-red-400';
            default: return 'text-slate-400';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'healthy': return '✅';
            case 'warning': return '⚠️';
            case 'error': return '❌';
            default: return '❓';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'healthy': return 'Operational';
            case 'warning': return 'Degraded';
            case 'error': return 'Down';
            default: return 'Unknown';
        }
    };

    const systemComponents = [
        {
            name: 'Database',
            status: systemHealth.database,
            description: 'Primary database connection'
        },
        {
            name: 'API Server',
            status: systemHealth.api,
            description: 'REST API endpoints'
        },
        {
            name: 'WebSocket',
            status: systemHealth.websocket,
            description: 'Real-time communication'
        }
    ];

    const overallStatus = Object.values(systemHealth).includes('error') ? 'error' :
        Object.values(systemHealth).includes('warning') ? 'warning' : 'healthy';

    return (
        <div className="card">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-semibold text-white">System Status</h2>
                    <div className="flex items-center gap-2 mt-1">
            <span className={`text-sm font-medium ${getStatusColor(overallStatus)}`}>
              {getStatusIcon(overallStatus)} Overall: {getStatusText(overallStatus)}
            </span>
                        <span className="text-slate-500 text-xs">
              • Last checked: {lastChecked.toLocaleTimeString()}
            </span>
                    </div>
                </div>
                <Button
                    onClick={checkSystemHealth}
                    variant="outline"
                    size="small"
                >
                    🔄 Refresh
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {systemComponents.map((component, index) => (
                    <div key={index} className="bg-slate-800/50 p-4 rounded-lg">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="text-xl">{getStatusIcon(component.status)}</span>
                            <div className="flex-1">
                                <h4 className="text-white font-medium">{component.name}</h4>
                                <p className="text-slate-400 text-sm">{component.description}</p>
                            </div>
                        </div>
                        <div className={`text-sm font-medium ${getStatusColor(component.status)}`}>
                            {getStatusText(component.status)}
                        </div>
                    </div>
                ))}
            </div>

            {/* Recent Activity Log (Mock) */}
            <div className="mt-6 pt-6 border-t border-slate-700">
                <h3 className="text-lg font-medium text-white mb-4">Recent System Events</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                    {[
                        { time: '14:32', event: 'Database backup completed successfully', type: 'info' },
                        { time: '14:15', event: 'User authentication service restarted', type: 'warning' },
                        { time: '13:45', event: 'New user registration: john_doe', type: 'info' },
                        { time: '13:30', event: 'Scheduled maintenance completed', type: 'success' },
                        { time: '13:00', event: 'Cache cleared and rebuilt', type: 'info' }
                    ].map((log, index) => (
                        <div key={index} className="flex items-center gap-3 text-sm py-1">
                            <span className="text-slate-500 font-mono">{log.time}</span>
                            <span className={`w-2 h-2 rounded-full ${
                                log.type === 'success' ? 'bg-green-400' :
                                    log.type === 'warning' ? 'bg-yellow-400' :
                                        log.type === 'error' ? 'bg-red-400' : 'bg-blue-400'
                            }`}></span>
                            <span className="text-slate-300">{log.event}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};