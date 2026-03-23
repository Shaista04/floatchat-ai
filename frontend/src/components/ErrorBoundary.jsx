import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    console.error("ErrorBoundary caught an error", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, background: '#fef2f2', color: '#991b1b', height: '100vh', overflow: 'auto' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold' }}>Dashboard crashed!</h2>
          <p>Here is the exact React error trace:</p>
          <details style={{ whiteSpace: 'pre-wrap', marginTop: '20px', fontFamily: 'monospace', background: '#fee2e2', padding: '20px', borderRadius: '8px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Click to view details</summary>
            {this.state.error && this.state.error.toString()}
            <br /><br />
            {this.state.info && this.state.info.componentStack}
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}
