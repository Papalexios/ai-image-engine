import React, { useEffect } from 'react';
import { WordPressPost } from '../types';
import { CheckCircle2, AlertTriangle, Loader, XIcon } from './icons/Icons';

interface Props {
  posts: WordPressPost[];
  totalJobs: number;
  onClose: () => void;
  onClearCompleted: () => void;
}

const GenerationModal: React.FC<Props> = ({ posts, totalJobs, onClose, onClearCompleted }) => {
  const pendingCount = posts.length;
  const completedCount = Math.max(0, totalJobs - pendingCount);

  // Effect to lock background scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  const StatusIcon = ({ status }: { status: WordPressPost['status'] }) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default:
        return <Loader className="w-5 h-5 text-brand-primary animate-spin" />;
    }
  };

  const getPostFromStatus = (post: WordPressPost) => {
      // Find the most up-to-date post from the main state to display correct status
      // This is a potential improvement if stale state in the job queue is an issue.
      // For now, we trust the status on the job object passed in.
      return post;
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-surface rounded-lg shadow-2xl w-full max-w-2xl border border-border max-h-[90vh] flex flex-col">
        <header className="flex justify-between items-center p-4 border-b border-border">
          <h2 className="text-xl font-bold text-text-primary">Generation Progress</h2>
          <button onClick={onClose} className="p-1 rounded-full text-subtle hover:bg-surface-muted hover:text-text-primary">
            <XIcon className="w-6 h-6" />
          </button>
        </header>
        
        <div className="p-6 flex-grow overflow-y-auto">
          {posts.length === 0 && completedCount > 0 ? (
            <div className="text-center text-muted py-8">
              <p>All {completedCount} jobs are complete.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {posts.map(job => {
                const post = getPostFromStatus(job);
                return (
                  <li key={post.id} className="flex items-center justify-between bg-surface-muted/50 p-3 rounded-md border border-border">
                    <div className="flex items-center space-x-3 overflow-hidden">
                      <div className="flex-shrink-0">
                        <StatusIcon status={post.status} />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-sm font-medium text-text-secondary truncate">{post.title.rendered}</p>
                        <p className={`text-xs ${post.status === 'error' ? 'text-red-500' : 'text-muted'}`}>{post.statusMessage || 'Waiting in queue...'}</p>
                      </div>
                    </div>
                    {post.generatedImage && post.status === 'success' && (
                      <img src={post.generatedImage.url} alt="Generated" className="w-10 h-10 rounded-md object-cover flex-shrink-0 ml-4"/>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        
        <footer className="p-4 border-t border-border flex justify-between items-center bg-surface-muted/30">
            <p className="text-sm text-muted">{completedCount} of {totalJobs} jobs completed.</p>
            <div className="flex items-center gap-3">
                 <button onClick={onClearCompleted} className="inline-flex items-center justify-center gap-2 text-sm font-semibold tracking-wide py-2 px-4 rounded-lg transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none bg-surface text-text-secondary border border-border shadow-sm hover:border-brand-primary hover:text-brand-primary hover:shadow focus:ring-brand-primary">
                    Clear All
                </button>
                <button onClick={onClose} className="inline-flex items-center justify-center gap-2 text-sm font-semibold tracking-wide py-2 px-4 rounded-lg transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none text-white bg-gradient-to-br from-brand-primary to-brand-secondary shadow hover:shadow-md hover:-translate-y-0.5 focus:ring-brand-primary">
                    Close
                </button>
            </div>
        </footer>
      </div>
    </div>
  );
};

export default GenerationModal;