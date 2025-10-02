
import React from 'react';
import { CrawlProgress } from '../types';

interface Props {
  progress: CrawlProgress;
}

const CrawlingStep: React.FC<Props> = ({ progress }) => {
  const percentage = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  return (
    <div className="flex flex-col items-center justify-center bg-surface rounded-lg shadow-xl p-8 max-w-2xl mx-auto animate-fade-in border border-border">
      <h2 className="text-2xl font-bold text-text-primary mb-4">Scanning Your Website...</h2>
      <p className="text-text-secondary mb-6 text-center">
        Fetching posts and auditing for existing images. This may take a few moments.
      </p>
      <div className="w-full bg-background rounded-full h-4 overflow-hidden border border-border">
        <div 
          className="bg-brand-primary h-4 rounded-full transition-all duration-500 ease-out" 
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
      <div className="mt-4 text-center font-semibold text-brand-accent">
        {progress.current} / {progress.total} posts discovered
      </div>
      <div className="mt-8 text-muted">
        <svg className="animate-spin h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    </div>
  );
};

export default CrawlingStep;
