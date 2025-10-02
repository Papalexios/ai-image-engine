import React, { useState, useEffect } from 'react';
import { WordPressPost } from '../types';
import { XIcon } from './icons/Icons';

interface Props {
  posts: WordPressPost[];
  onClose: () => void;
  onSave: (updates: { mediaId: number; altText: string }[]) => void;
}

const BulkAltTextModal: React.FC<Props> = ({ posts, onClose, onSave }) => {
  const [altTexts, setAltTexts] = useState<Record<number, string>>({});

  // Effect to lock background scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  useEffect(() => {
    // Initialize state with current alt texts from posts
    const initialAltTexts = posts.reduce((acc, post) => {
      if (post.generatedImage) {
        acc[post.generatedImage.mediaId] = post.generatedImage.alt;
      }
      return acc;
    }, {} as Record<number, string>);
    setAltTexts(initialAltTexts);
  }, [posts]);

  const handleTextChange = (mediaId: number, newText: string) => {
    setAltTexts(prev => ({
      ...prev,
      [mediaId]: newText,
    }));
  };

  const handleSave = () => {
    const updates = Object.entries(altTexts).map(([mediaId, altText]) => ({
      mediaId: Number(mediaId),
      altText,
    }));
    onSave(updates);
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-surface rounded-lg shadow-2xl w-full max-w-3xl border border-border max-h-[90vh] flex flex-col">
        <header className="flex justify-between items-center p-4 border-b border-border">
          <h2 className="text-xl font-bold text-text-primary">Bulk Edit Alt Text</h2>
          <button onClick={onClose} className="p-1 rounded-full text-subtle hover:bg-surface-muted hover:text-text-primary">
            <XIcon className="w-6 h-6" />
          </button>
        </header>
        
        <div className="p-6 flex-grow overflow-y-auto">
          <p className="text-sm text-text-secondary mb-4">
            Editing alt text for {posts.length} selected post(s). Make your changes below and save.
          </p>
          <div className="space-y-4">
            {posts.map(post => post.generatedImage && (
              <div key={post.id} className="flex items-start space-x-4 bg-surface-muted/50 p-3 rounded-md border border-border">
                <img 
                  src={post.generatedImage.url} 
                  alt={post.generatedImage.alt} 
                  className="w-20 h-20 rounded-md object-cover flex-shrink-0"
                />
                <div className="flex-grow">
                  <p className="text-sm font-semibold text-text-primary truncate" title={post.title.rendered}>{post.title.rendered}</p>
                  <textarea
                    value={altTexts[post.generatedImage.mediaId] || ''}
                    onChange={(e) => handleTextChange(post.generatedImage!.mediaId, e.target.value)}
                    rows={3}
                    className="mt-1 w-full bg-background border border-border rounded-md px-3 py-2 text-text-primary text-sm focus:ring-2 focus:ring-brand-primary focus:outline-none transition-colors"
                    placeholder="Enter descriptive alt text..."
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <footer className="p-4 border-t border-border flex justify-end items-center gap-3 bg-surface-muted/30">
          <button onClick={onClose} className="inline-flex items-center justify-center gap-2 text-sm font-semibold tracking-wide py-2 px-4 rounded-lg transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none bg-surface text-text-secondary border border-border shadow-sm hover:border-brand-primary hover:text-brand-primary hover:shadow focus:ring-brand-primary">
            Cancel
          </button>
          <button onClick={handleSave} className="inline-flex items-center justify-center gap-2 text-sm font-semibold tracking-wide py-2 px-4 rounded-lg transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none text-white bg-gradient-to-br from-brand-primary to-brand-secondary shadow hover:shadow-md hover:-translate-y-0.5 focus:ring-brand-primary">
            Save Changes
          </button>
        </footer>
      </div>
    </div>
  );
};

export default BulkAltTextModal;