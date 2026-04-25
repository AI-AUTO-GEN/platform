import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    // Clear local storage if it's a corrupted JSON state issue, but PROTECT auth tokens
    if (this.state.error?.message?.includes('JSON')) {
      // Remove specific state caches if any, but NEVER clear everything
      // localStorage.clear(); // <-- VULNERABILITY FIXED: Do not delete Supabase Auth Token
      console.warn('Recovering from JSON error without wiping session');
    }
    window.location.reload();
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#0a0a0a',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Inter, system-ui, sans-serif',
          padding: '20px',
          textAlign: 'center'
        }}>
          <AlertTriangle size={64} color="#ef4444" style={{ marginBottom: '20px' }} />
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px' }}>Something went wrong</h1>
          <p style={{ color: '#a3a3a3', maxWidth: '600px', marginBottom: '30px' }}>
            The application encountered an unexpected error. This usually happens when project data is corrupted.
          </p>
          
          <div style={{
            backgroundColor: '#171717',
            padding: '15px',
            borderRadius: '8px',
            border: '1px solid #262626',
            maxWidth: '800px',
            width: '100%',
            overflowX: 'auto',
            marginBottom: '30px',
            textAlign: 'left'
          }}>
            <code style={{ color: '#ef4444', fontSize: '14px' }}>
              {this.state.error && this.state.error.toString()}
            </code>
          </div>

          <button 
            onClick={this.handleReset}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '6px',
              fontSize: '16px',
              cursor: 'pointer',
              fontWeight: '500',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
          >
            <RefreshCw size={18} />
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
