import React, { useState, useEffect } from 'react';
import { WordPressPost, Configuration, AIProvider, TextAIProvider } from '../types';
import { analyzeImageWithVision } from '../services/aiService';
import { updateMediaAltText } from '../services/wordpressService';
import { XIcon, Loader, CheckCircle2, AlertTriangle, SparklesIcon } from './icons/Icons';

interface Props {
  post: WordPressPost;
  config: Configuration;
  onClose: () => void;
  onUpdatePost: (postId: number, updates: Partial<WordPressPost>) => void;
  onRegenerate: (post: WordPressPost) => void;
}

const AnalysisModal: React.FC<Props> = ({ post, config, onClose, onUpdatePost, onRegenerate }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<{ score: number; altText: string; brief: string; } | null>(null);

  // Effect to lock background scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  useEffect(() => {
    const performAnalysis = async () => {
      // Find the Gemini API key from the configuration, regardless of which service it's configured for.
      const geminiApiKey = config.ai.image.provider === AIProvider.Gemini 
          ? config.ai.image.apiKey 
          : config.ai.analysis.apiKey;
          
      if (!post.existingImageUrl) {
        setError("No existing image URL found for analysis.");
        setIsLoading(false);
        return;
      }
      if (config.ai.image.provider !== AIProvider.Gemini && config.ai.analysis.provider !== TextAIProvider.Gemini) {
          setError("Google Gemini must be selected as an Image or Analysis provider to use AI Vision.");
          setIsLoading(false);
          return;
      }
      if (!geminiApiKey) {
        setError("A Google Gemini API key is required for Vision Analysis, but it is not configured.");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        onUpdatePost(post.id, { status: 'analyzing', statusMessage: 'Analyzing existing image...' });
        const result = await analyzeImageWithVision(geminiApiKey, post.existingImageUrl);
        setAnalysis(result);
        onUpdatePost(post.id, { status: 'analysis_success', statusMessage: `Analysis complete. Score: ${result.score}/10`, analysis: result });
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Failed to analyze image.';
        setError(errorMessage);
        onUpdatePost(post.id, { status: 'error', statusMessage: errorMessage });
      } finally {
        setIsLoading(false);
      }
    };
    performAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id, post.existingImageUrl, onUpdatePost, config]);

  const handleApplyAltText = async () => {
    if (!analysis || !post.featured_media) return;
    try {
      await updateMediaAltText(config.wordpress, post.featured_media, analysis.altText);
      onUpdatePost(post.id, { statusMessage: 'New alt text applied!' });
    } catch (e) {
      onUpdatePost(post.id, { status: 'error', statusMessage: 'Failed to apply alt text.' });
    }
  };

  const handleRegenerate = () => {
      if (!analysis) return;
      const postWithBrief = {
          ...post,
          generatedImage: {
              ...(post.generatedImage || { url: '', mediaId: 0 }),
              alt: analysis.altText,
              brief: analysis.brief,
          }
      };
      onRegenerate(postWithBrief);
      onClose();
  };

  const renderContent = () => {
    if (isLoading) {
      return <div className="flex flex-col items-center justify-center h-full"><Loader className="w-10 h-10 animate-spin text-brand-primary" /><p className="mt-4 text-text-secondary">AI Vision is analyzing the image...</p></div>;
    }
    if (error) {
      return <div className="flex flex-col items-center justify-center h-full"><AlertTriangle className="w-10 h-10 text-red-500" /><p className="mt-4 text-red-400">{error}</p></div>;
    }
    if (analysis) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <img src={post.existingImageUrl} alt="Image being analyzed" className="rounded-lg w-full h-auto object-contain" />
             <div className="text-center">
                <p className="text-sm text-text-secondary">Quality Score</p>
                <p className="text-4xl font-bold text-brand-primary">{analysis.score}<span className="text-2xl text-muted">/10</span></p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-text-primary mb-1">Suggested Alt Text</h4>
              <p className="text-sm bg-surface-muted border border-border rounded-md p-3 text-text-secondary">{analysis.altText}</p>
              <button onClick={handleApplyAltText} className="text-sm mt-2 flex items-center gap-2 text-brand-primary hover:underline">
                <CheckCircle2 className="w-4 h-4"/> Apply this alt text
              </button>
            </div>
             <div>
              <h4 className="font-semibold text-text-primary mb-1">New Image Brief</h4>
              <p className="text-sm bg-surface-muted border border-border rounded-md p-3 text-text-secondary">{analysis.brief}</p>
              <button onClick={handleRegenerate} className="text-sm mt-2 flex items-center gap-2 text-brand-primary hover:underline">
                <SparklesIcon className="w-4 h-4"/> Regenerate with this brief
              </button>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-surface rounded-lg shadow-2xl w-full max-w-3xl border border-border max-h-[90vh] flex flex-col">
        <header className="flex justify-between items-center p-4 border-b border-border">
          <h2 className="text-xl font-bold text-text-primary">AI Vision Analysis</h2>
          <button onClick={onClose} className="p-1 rounded-full text-subtle hover:bg-surface-muted hover:text-text-primary">
            <XIcon className="w-6 h-6" />
          </button>
        </header>
        <div className="p-6 flex-grow overflow-y-auto min-h-[20rem]">
          {renderContent()}
        </div>
        <footer className="p-4 border-t border-border flex justify-end bg-surface-muted/30">
          <button onClick={onClose} className="inline-flex items-center justify-center gap-2 text-sm font-semibold tracking-wide py-2 px-4 rounded-lg transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface text-white bg-gradient-to-br from-brand-primary to-brand-secondary shadow hover:shadow-md hover:-translate-y-0.5 focus:ring-brand-primary">
            Close
          </button>
        </footer>
      </div>
    </div>
  );
};

export default AnalysisModal;