
import React from 'react';
import { WordPressPost } from '../types';
import { ImageIcon, SparklesIcon, UploadCloudIcon, ExternalLinkIcon, RefreshCwIcon, BookOpenIcon } from './icons/Icons';

interface Props {
  post: WordPressPost;
  isSelected: boolean;
  onToggleSelect: () => void;
  onGenerate: () => void;
  onInsert: () => void;
  onSetFeatured: () => void;
  onAnalyze: () => void;
}

const PostCard: React.FC<Props> = ({ post, isSelected, onToggleSelect, onGenerate, onInsert, onSetFeatured, onAnalyze }) => {
  const needsImage = post.featured_media === 0 || post.imageCount === 0;

  const stripHtml = (html: string) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || "";
  };

  const getStatusIndicator = () => {
    if (!post.status || post.status === 'idle' || post.status === 'success' || post.status === 'error' || post.status === 'analysis_success') {
      return null;
    }
    return (
      <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm p-2 rounded-full z-20">
        <svg className="animate-spin h-5 w-5 text-brand-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  };
  
  const displayImageUrl = post.generatedImage?.url || post.existingImageUrl;
  const canInsert = !!post.generatedImage?.url || !!post.existingImageUrl;
  const canSetFeatured = !!post.generatedImage?.mediaId;


  return (
    <div className={`bg-surface rounded-lg overflow-hidden border transition-all duration-200 group relative flex flex-col ${isSelected ? 'border-brand-primary shadow-lg scale-[1.02]' : 'border-border hover:border-subtle hover:shadow-md'}`}>
      <div className="relative">
         <div 
            onClick={onToggleSelect} 
            className="absolute inset-0 bg-black/50 transition-opacity opacity-0 group-hover:opacity-100 z-10 cursor-pointer"
        >
             <input 
                type="checkbox" 
                readOnly
                checked={isSelected}
                className="absolute top-3 left-3 h-5 w-5 rounded bg-background/50 border-slate-500 text-brand-primary focus:ring-brand-primary cursor-pointer"
            />
        </div>
        
        {getStatusIndicator()}

        <div className="w-full h-40 bg-surface-muted flex items-center justify-center">
            {displayImageUrl ? (
                <img src={displayImageUrl} alt={post.generatedImage?.alt || post.existingImageAltText || stripHtml(post.title.rendered)} className="w-full h-full object-cover" />
            ) : (
                <div className="text-center text-muted">
                    <ImageIcon className="w-10 h-10 mx-auto" />
                    <p className="text-sm mt-1">No Image</p>
                </div>
            )}
        </div>
      </div>

      <div className="p-3 flex-grow">
        <a href={post.link} target="_blank" rel="noopener noreferrer" className="text-md font-bold text-text-primary hover:text-brand-primary line-clamp-2 leading-snug flex items-start">
          <span className="flex-1">{stripHtml(post.title.rendered)}</span>
          <ExternalLinkIcon className="w-4 h-4 ml-1.5 mt-0.5 text-subtle opacity-0 group-hover:opacity-100 transition-opacity" />
        </a>
        <div className="mt-2 flex items-center space-x-3 text-xs text-muted">
          <span className={`px-2 py-0.5 rounded-full ${needsImage ? 'bg-red-500/10 text-red-500 dark:bg-red-500/20 dark:text-red-300' : 'bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-300'}`}>
            {post.featured_media === 0 ? 'No Featured' : 'Has Featured'}
          </span>
          <span className="font-mono">{post.imageCount} img(s)</span>
        </div>
        
        {post.statusMessage && (
          <p className={`mt-2 text-xs font-medium rounded px-2 py-1 ${post.status === 'error' ? 'bg-red-500/10 text-red-500' : post.status === 'success' || post.status === 'analysis_success' ? 'bg-green-500/10 text-green-600' : 'bg-sky-500/10 text-sky-600'}`}>
            {post.statusMessage}
          </p>
        )}
      </div>

      <div className="p-2 bg-surface-muted/50 border-t border-border mt-auto">
        <div className="flex items-center justify-center gap-1.5">
          {post.existingImageUrl && !post.generatedImage ? (
              <button onClick={onAnalyze} className="flex-grow text-white bg-gradient-to-br from-brand-primary to-brand-secondary shadow-sm hover:shadow-md hover:-translate-y-0.5 inline-flex items-center justify-center gap-1.5 text-sm font-semibold py-2 px-3 rounded-md transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface-muted disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none">
                <BookOpenIcon className="w-4 h-4"/>
                <span>Analyze</span>
              </button>
          ) : (
            <button onClick={onGenerate} className="flex-grow text-white bg-gradient-to-br from-brand-primary to-brand-secondary shadow-sm hover:shadow-md hover:-translate-y-0.5 inline-flex items-center justify-center gap-1.5 text-sm font-semibold py-2 px-3 rounded-md transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface-muted disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none">
                <SparklesIcon className="w-4 h-4"/>
                <span>Generate</span>
            </button>
          )}
           <button onClick={onGenerate} className="!p-2 bg-surface text-text-secondary border border-border hover:border-brand-primary hover:text-brand-primary hover:shadow disabled:hover:bg-surface disabled:hover:text-text-secondary disabled:hover:border-border inline-flex items-center justify-center gap-1.5 text-sm font-semibold py-2 px-3 rounded-md transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface-muted disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none" title="Regenerate">
             <RefreshCwIcon className="w-4 h-4"/>
          </button>
          <div className="w-px h-6 bg-border mx-1"></div>
          <button disabled={!canInsert} onClick={onInsert} className="!p-2 bg-surface text-text-secondary border border-border hover:border-brand-primary hover:text-brand-primary hover:shadow disabled:hover:bg-surface disabled:hover:text-text-secondary disabled:hover:border-border inline-flex items-center justify-center gap-1.5 text-sm font-semibold py-2 px-3 rounded-md transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface-muted disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none" title="Insert Image into Post">
            <ImageIcon className="w-4 h-4" />
          </button>
          <button disabled={!canSetFeatured} onClick={onSetFeatured} className="!p-2 bg-surface text-text-secondary border border-border hover:border-brand-primary hover:text-brand-primary hover:shadow disabled:hover:bg-surface disabled:hover:text-text-secondary disabled:hover:border-border inline-flex items-center justify-center gap-1.5 text-sm font-semibold py-2 px-3 rounded-md transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface-muted disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none" title="Set as Featured Image">
            <UploadCloudIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PostCard;