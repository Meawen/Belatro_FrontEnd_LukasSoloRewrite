import  { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, Panel, PixelIcon } from '../ui';
import { Wordmark } from '../layout/Wordmark';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
    /** The app's root boundary: its fallback fills the page, in a minimal wordmark frame (spec §4.1). */
    fullPage?: boolean;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.props.onError?.(error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            const notice = (
                <Panel padding="lg" className="mx-auto w-full max-w-md">
                    <div className="flex flex-col items-center gap-3 text-center">
                        <PixelIcon name="warning" scale={3} className="text-danger-text" />
                        <h2 className="t-title">Something went wrong</h2>
                        <p className="t-body text-text-2">
                            An unexpected error occurred. Please refresh the page or try again later.
                        </p>
                        {/* Full page loads on purpose (R-29): this boundary also wraps the app's
                            routes (Phase 7), and a fresh load drops whatever state crashed. */}
                        <div className="mt-2 flex flex-wrap justify-center gap-3">
                            <Button onClick={() => window.location.reload()}>
                                Reload
                            </Button>
                            <Button variant="secondary" onClick={() => window.location.assign('/dashboard')}>
                                Go to dashboard
                            </Button>
                        </div>
                    </div>
                </Panel>
            );

            if (!this.props.fullPage) return <div className="px-4 py-8">{notice}</div>;

            return (
                <div className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-bg px-4 py-10 text-text">
                    <Wordmark className="t-display" />
                    {notice}
                </div>
            );
        }

        return this.props.children;
    }
}
