import React, { ReactNode } from 'react';
import { reportFrontendCrash } from '../utils/reportFrontendCrash';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch() {
    console.error('EdgeView interface rendering failed.');
    void reportFrontendCrash();
  }

  private handleReset = () => {
    if (this.props.onReset) {
      this.props.onReset();
    }
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-[#141414] border border-[#262626] rounded-xl flex flex-col items-center justify-center text-center space-y-4 max-w-lg mx-auto my-8">
          <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-lg text-red-400">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-sm font-semibold text-white">
              {this.props.fallbackTitle || 'Section Render Failure'}
            </h3>
            <p className="text-xs text-gray-400 max-w-sm">
              This view could not be displayed. Reset the section to try again. If the problem continues, open Settings to check diagnostics.
            </p>
          </div>
          <p className="text-[10px] font-mono text-gray-500">Error code: REACT_RENDER_FAILED</p>
          <button
            onClick={this.handleReset}
            className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-[#222222] hover:bg-[#333] text-gray-300 hover:text-white font-medium text-xs border border-[#333] transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Section</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
