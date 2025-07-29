import React from 'react';
import { Outlet } from 'react-router-dom';
import { Footer } from './Footer';
import { Sidebar } from './Sidebar';

export interface AppLayoutProps {
    children?: React.ReactNode;
    showSidebar?: boolean;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
                                                        children,
                                                        showSidebar = false
                                                    }) => {
    return (
        <div className="min-h-screen bg-emerald-950 flex flex-col">
            {/* Main Content Area */}
            <div className="flex flex-1">
                {/* Sidebar */}
                {showSidebar && <Sidebar />}

                {/* Page Content */}
                <main className="flex-1 min-w-0">
                    <div className="py-8">
                        {children || <Outlet />}
                    </div>
                </main>
            </div>

            {/* Footer */}
            <Footer />
        </div>
    );
};