import React, { useState, useCallback, useEffect } from 'react';
import { AppState, Configuration, CrawlProgress, WordPressPost, AIProvider, TextAIProvider } from './types';
import ConfigurationStep from './components/ConfigurationStep';
import CrawlingStep from './components/CrawlingStep';
import ResultsStep from './components/ResultsStep';
import { AppIcon, GeminiIcon, SunIcon, MoonIcon } from './components/icons/Icons';
import { fetchPosts, getTotalPosts } from './services/wordpressService';

const useTheme = () => {
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedTheme = window.localStorage.getItem('theme');
      if (storedTheme) return storedTheme;
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    }
    return 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    window.localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'dark' ? 'light' : 'dark'));
  };

  return { theme, toggleTheme };
};

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.Configuration);
  const [config, setConfig] = useState<Configuration | null>(null);
  const [posts, setPosts] = useState<WordPressPost[]>([]);
  const [crawlProgress, setCrawlProgress] = useState<CrawlProgress>({ current: 0, total: 0 });
  const { theme, toggleTheme } = useTheme();

  const handleStartCrawling = useCallback(async (newConfig: Configuration) => {
    setConfig(newConfig);
    setAppState(AppState.Crawling);
    setPosts([]);
    
    try {
      const total = await getTotalPosts(newConfig.wordpress.url, newConfig.wordpress.username, newConfig.wordpress.appPassword);
      setCrawlProgress({ current: 0, total });

      let allPosts: WordPressPost[] = [];
      let currentPage = 1;
      const perPage = 100; // Increased from 20 to 100 for much faster crawling

      while (allPosts.length < total) {
        const fetchedPosts = await fetchPosts(newConfig.wordpress.url, newConfig.wordpress.username, newConfig.wordpress.appPassword, currentPage, perPage);
        if (fetchedPosts.length === 0) break;
        
        allPosts = [...allPosts, ...fetchedPosts];
        setPosts(prev => [...prev, ...fetchedPosts]);
        setCrawlProgress(prev => ({ ...prev, current: allPosts.length }));
        currentPage++;
      }
      
      const sortedPosts = allPosts.sort((a, b) => {
        const aScore = (a.featured_media === 0 ? 1000 : 0) + (100 - a.imageCount);
        const bScore = (b.featured_media === 0 ? 1000 : 0) + (100 - b.imageCount);
        return bScore - aScore;
      });

      setPosts(sortedPosts);
      setAppState(AppState.Results);
    } catch (error: any) {
      console.error("Crawling failed:", error);
      let message = "Failed to connect to WordPress site.";
      if (error.message.includes('401') || error.message.includes('403')) {
        message = "Authentication failed. Please check your WordPress Username and Application Password.";
      } else if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        message = "A network error occurred. This is often a CORS issue. Please ensure your WordPress server is configured to allow requests from this origin. You may need to add custom headers via a plugin or your server configuration.";
      } else if (error.message.includes('404')) {
          message = "Could not find the WordPress REST API endpoint. Please ensure your Site URL is correct and REST API is enabled."
      } else {
         message = error.message || "An unknown error occurred.";
      }
      
      alert(`Connection Error:\n${message}`);
      setAppState(AppState.Configuration);
    }
  }, []);

  const handleReset = () => {
    setAppState(AppState.Configuration);
    setConfig(null);
    setPosts([]);
    setCrawlProgress({ current: 0, total: 0 });
  };
  
  const renderContent = () => {
    switch (appState) {
      case AppState.Configuration:
        return <ConfigurationStep onConfigure={handleStartCrawling} />;
      case AppState.Crawling:
        return <CrawlingStep progress={crawlProgress} />;
      case AppState.Results:
        return <ResultsStep initialPosts={posts} config={config!} onReset={handleReset} />;
      default:
        return <div>Unknown state</div>;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center p-4 sm:p-6 lg:p-8">
      <header className="w-full max-w-7xl mx-auto flex justify-between items-center mb-6 pb-4 border-b border-border">
        <div>
          <div className="flex items-center space-x-3">
            <AppIcon className="h-9 w-9" />
            <span className="text-2xl font-bold text-text-primary tracking-tight">AI Image Engine</span>
          </div>
          <a href="https://affiliatemarketingforsuccess.com" target="_blank" rel="noopener noreferrer" className="text-xs text-muted hover:text-brand-primary transition-colors ml-12 -mt-1 block">
            From the creators of AffiliateMarketingForSuccess.com
          </a>
        </div>
        <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm text-muted">
              <span>Powered by</span>
              <GeminiIcon className="h-6 w-6" />
            </div>
            <button onClick={toggleTheme} className="p-2 rounded-full bg-surface-muted hover:bg-border text-text-secondary hover:text-text-primary transition-colors">
              {theme === 'dark' ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
            </button>
        </div>
      </header>
      <main className="w-full max-w-7xl mx-auto flex-grow">
        {renderContent()}
      </main>
      <footer className="w-full max-w-7xl mx-auto mt-12 py-8 border-t border-border text-center text-sm text-muted">
        <div className="flex flex-col items-center gap-4">
          <a href="https://affiliatemarketingforsuccess.com" target="_blank" rel="noopener noreferrer">
            <img 
              src="https://affiliatemarketingforsuccess.com/wp-content/uploads/2023/03/cropped-Affiliate-Marketing-for-Success-Logo-Edited.png?lm=6666FEE0" 
              alt="Affiliate Marketing for Success Logo" 
              className="h-16 w-auto mb-2 hover:opacity-80 transition-opacity"
            />
          </a>
          <p>
            This App is Created by Alexios Papaioannou, Owner of <a href="https://affiliatemarketingforsuccess.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-text-secondary hover:text-brand-primary transition-colors">affiliatemarketingforsuccess.com</a>
          </p>
          <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-2 text-xs mt-2">
            <span className="font-semibold">Learn more about:</span>
            <a href="https://affiliatemarketingforsuccess.com/affiliate-marketing" target="_blank" rel="noopener noreferrer" className="hover:text-brand-primary transition-colors">Affiliate Marketing</a>
            <span className="text-subtle" aria-hidden="true">|</span>
            <a href="https://affiliatemarketingforsuccess.com/ai" target="_blank" rel="noopener noreferrer" className="hover:text-brand-primary transition-colors">AI</a>
            <span className="text-subtle" aria-hidden="true">|</span>
            <a href="https://affiliatemarketingforsuccess.com/seo" target="_blank" rel="noopener noreferrer" className="hover:text-brand-primary transition-colors">SEO</a>
            <span className="text-subtle" aria-hidden="true">|</span>
            <a href="https://affiliatemarketingforsuccess.com/blogging" target="_blank" rel="noopener noreferrer" className="hover:text-brand-primary transition-colors">Blogging</a>
            <span className="text-subtle" aria-hidden="true">|</span>
            <a href="https://affiliatemarketingforsuccess.com/review" target="_blank" rel="noopener noreferrer" className="hover:text-brand-primary transition-colors">Reviews</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;