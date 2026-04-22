import React from 'react';

export default class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message || 'A runtime error occurred.'
    };
  }

  componentDidCatch(error, info) {
    console.error('RouteErrorBoundary caught:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div style={{ maxWidth: '520px', width: '100%', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(12,12,20,0.92)', borderRadius: '14px', padding: '1.2rem 1.1rem' }}>
            <h2 style={{ margin: 0, color: 'white', fontFamily: 'var(--font-display)', fontSize: '1.05rem' }}>Something went wrong</h2>
            <p style={{ margin: '0.5rem 0 0 0', color: 'rgba(255,255,255,0.75)', fontFamily: 'var(--font-body)', fontSize: '0.9rem', lineHeight: 1.5 }}>
              A runtime error occurred in this route. You can reload the page and continue.
            </p>
            <p style={{ margin: '0.55rem 0 0 0', color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-body)', fontSize: '0.8rem' }}>
              Details: {this.state.message}
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              style={{ marginTop: '0.85rem', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.06)', color: 'white', borderRadius: '999px', padding: '0.42rem 0.8rem', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'var(--font-body)' }}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

