import { Component } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#f0f2ff] px-4">
          <div className="text-center max-w-sm">

            <DotLottieReact
  src="/warning.json"
  loop
  autoplay
  className="w-40 h-40 mx-auto mb-6"
/>

            <h1 className="text-2xl font-bold text-[#1e1b4b] mb-2">
              Something broke
            </h1>
            <p className="text-sm text-slate-500 mb-6">
              An unexpected error occurred. Try again or go back to home.
            </p>

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="border border-indigo-600 text-indigo-600 px-5 py-2 rounded-lg text-sm hover:bg-indigo-50 transition-colors"
              >
                Try again
              </button>
              <button
                onClick={() => (window.location.href = '/')}
                className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-indigo-700 transition-colors"
              >
                Go Home
              </button>
            </div>

          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;