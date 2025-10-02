
import React, { useState, useCallback } from 'react';
import { Configuration, AIProvider, ImageFormat, AspectRatio, TextAIProvider } from '../types';
import { EyeIcon, EyeOffIcon, InfoIcon } from './icons/Icons';

interface Props {
  onConfigure: (config: Configuration) => void;
}

const ConfigurationStep: React.FC<Props> = ({ onConfigure }) => {
  const [wpUrl, setWpUrl] = useState('');
  const [wpUser, setWpUser] = useState('');
  const [wpPass, setWpPass] = useState('');
  const [showPass, setShowPass] = useState(false);

  const [aiProvider, setAiProvider] = useState<AIProvider>(AIProvider.Gemini);
  
  // New state for the analysis provider
  const [analysisProvider, setAnalysisProvider] = useState<TextAIProvider>(TextAIProvider.Gemini);
  const [analysisApiKey, setAnalysisApiKey] = useState('');
  const [analysisModel, setAnalysisModel] = useState('llama3-8b-8192');


  const [imageFormat, setImageFormat] = useState<ImageFormat>(ImageFormat.WebP);
  const [quality, setQuality] = useState(85);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.Landscape);
  const [style, setStyle] = useState('photorealistic, cinematic, high detail');
  const [negativePrompt, setNegativePrompt] = useState('text, logos, watermarks, blurry');

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!wpUrl || !wpUser || !wpPass) {
        alert("WordPress Site URL, Username, and Application Password are required.");
        return;
    }
    // New: Check for API key if required by analysis provider
    if (analysisProvider !== TextAIProvider.Gemini && !analysisApiKey) {
        alert(`An API Key is required for the ${analysisProvider} Content Analysis Provider.`);
        return;
    }
    onConfigure({
      wordpress: { url: wpUrl, username: wpUser, appPassword: wpPass },
      ai: { 
          provider: aiProvider,
          analysis: {
              provider: analysisProvider,
              apiKey: analysisApiKey,
              model: analysisModel
          }
      },
      image: { format: imageFormat, quality, aspectRatio, style, negativePrompt },
    });
  }, [wpUrl, wpUser, wpPass, aiProvider, imageFormat, quality, aspectRatio, style, negativePrompt, onConfigure, analysisProvider, analysisApiKey, analysisModel]);

  const getProviderInfoText = () => {
    switch (aiProvider) {
        case AIProvider.Gemini:
            return 'Gemini will use the API key configured for this application environment for image generation.';
        case AIProvider.Pollinations:
            return 'No API key needed for the free Pollinations provider.';
        default:
            return 'This provider is not implemented yet. Please select another.';
    }
  };

  return (
    <div className="bg-surface rounded-lg shadow-xl p-6 sm:p-8 max-w-4xl mx-auto animate-fade-in border border-border">
      <h2 className="text-2xl font-bold text-text-primary mb-2">Welcome to the AI Image Engine</h2>
      <p className="text-text-secondary mb-6">Start by configuring your WordPress site and AI image provider.</p>
      
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* WordPress Settings */}
        <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
          <fieldset className="border border-border p-4 rounded-lg">
            <legend className="text-lg font-semibold text-brand-primary px-2">WordPress Connection</legend>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1" htmlFor="wp-url">Site URL</label>
                <input id="wp-url" type="url" value={wpUrl} onChange={e => setWpUrl(e.target.value)} placeholder="https://yourblog.com" required className="w-full bg-background border border-border rounded-md px-3 py-2 text-text-primary focus:ring-2 focus:ring-brand-primary focus:outline-none transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1" htmlFor="wp-user">WordPress Username</label>
                <input id="wp-user" type="text" value={wpUser} onChange={e => setWpUser(e.target.value)} placeholder="admin" required className="w-full bg-background border border-border rounded-md px-3 py-2 text-text-primary focus:ring-2 focus:ring-brand-primary focus:outline-none transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1" htmlFor="wp-pass">Application Password</label>
                <div className="relative">
                  <input id="wp-pass" type={showPass ? 'text' : 'password'} value={wpPass} onChange={e => setWpPass(e.target.value)} placeholder="xxxx xxxx xxxx xxxx" required className="w-full bg-background border border-border rounded-md px-3 py-2 text-text-primary focus:ring-2 focus:ring-brand-primary focus:outline-none transition-colors" />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute inset-y-0 right-0 px-3 flex items-center text-subtle hover:text-text-primary">
                    {showPass ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </div>
             <p className="text-xs text-muted mt-2 flex items-start space-x-1.5">
                <InfoIcon className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>Generate this in your WordPress profile under Users &gt; Your Profile &gt; Application Passwords.</span>
             </p>
          </fieldset>
        </div>

        {/* AI Provider Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <fieldset className="border border-border p-4 rounded-lg">
                <legend className="text-lg font-semibold text-brand-primary px-2">Image Generation Provider</legend>
                <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1" htmlFor="ai-provider">Provider</label>
                    <select id="ai-provider" value={aiProvider} onChange={e => setAiProvider(e.target.value as AIProvider)} className="w-full bg-background border border-border rounded-md px-3 py-2 text-text-primary focus:ring-2 focus:ring-brand-primary focus:outline-none transition-colors">
                    {Object.values(AIProvider).map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>
                <p className="text-xs text-muted flex items-start space-x-1.5">
                        <InfoIcon className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span>{getProviderInfoText()}</span>
                    </p>
                </div>
            </fieldset>

            {/* New: Content Analysis Provider Settings */}
            <fieldset className="border border-border p-4 rounded-lg">
                <legend className="text-lg font-semibold text-brand-primary px-2">Content Analysis Provider</legend>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1" htmlFor="analysis-provider">Provider for Image Placement</label>
                        <select id="analysis-provider" value={analysisProvider} onChange={e => setAnalysisProvider(e.target.value as TextAIProvider)} className="w-full bg-background border border-border rounded-md px-3 py-2 text-text-primary focus:ring-2 focus:ring-brand-primary focus:outline-none transition-colors">
                            {Object.values(TextAIProvider).map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                     <p className="text-xs text-muted flex items-start space-x-1.5">
                        <InfoIcon className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span>This AI analyzes post content to find the best spot to insert an image. Use a different provider to avoid rate limits.</span>
                    </p>
                    {analysisProvider !== TextAIProvider.Gemini && (
                         <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1" htmlFor="analysis-api-key">API Key</label>
                            <input id="analysis-api-key" type="password" value={analysisApiKey} onChange={e => setAnalysisApiKey(e.target.value)} placeholder="Enter your API Key" required className="w-full bg-background border border-border rounded-md px-3 py-2 text-text-primary focus:ring-2 focus:ring-brand-primary focus:outline-none transition-colors" />
                        </div>
                    )}
                    {(analysisProvider === TextAIProvider.Groq || analysisProvider === TextAIProvider.OpenRouter) && (
                         <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1" htmlFor="analysis-model">Model Name</label>
                            <input id="analysis-model" type="text" value={analysisModel} onChange={e => setAnalysisModel(e.target.value)} placeholder="e.g., llama3-8b-8192" required className="w-full bg-background border border-border rounded-md px-3 py-2 text-text-primary focus:ring-2 focus:ring-brand-primary focus:outline-none transition-colors" />
                        </div>
                    )}
                </div>
            </fieldset>
        </div>


        {/* Image Customization Settings */}
        <fieldset className="border border-border p-4 rounded-lg">
          <legend className="text-lg font-semibold text-brand-primary px-2">Image Customization</legend>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Aspect Ratio</label>
              <div className="flex space-x-2">
                {Object.values(AspectRatio).map(ar => (
                  <button key={ar} type="button" onClick={() => setAspectRatio(ar)} className={`flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200 bg-surface-muted text-text-secondary hover:bg-border hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 focus:ring-offset-surface ${aspectRatio === ar ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary shadow-sm' : ''}`}>
                    {ar}
                  </button>
                ))}
              </div>
            </div>
             <div>
                <label className="block text-sm font-medium text-text-secondary mb-1" htmlFor="quality">Quality ({quality}%)</label>
                <input id="quality" type="range" min="10" max="100" step="5" value={quality} onChange={e => setQuality(Number(e.target.value))} className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-brand-primary" />
             </div>
             <div>
              <label className="block text-sm font-medium text-text-secondary mb-1" htmlFor="format">Format</label>
                <select id="format" value={imageFormat} onChange={e => setImageFormat(e.target.value as ImageFormat)} className="w-full bg-background border border-border rounded-md px-3 py-2 text-text-primary focus:ring-2 focus:ring-brand-primary focus:outline-none transition-colors">
                  <option value={ImageFormat.WebP}>WebP</option>
                  <option value={ImageFormat.JPEG}>JPEG</option>
                  <option value={ImageFormat.PNG}>PNG</option>
                </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <div>
                <label className="block text-sm font-medium text-text-secondary mb-1" htmlFor="style">Image Style</label>
                <textarea id="style" value={style} onChange={e => setStyle(e.target.value)} rows={2} placeholder="e.g., photorealistic, cinematic" className="w-full bg-background border border-border rounded-md px-3 py-2 text-text-primary focus:ring-2 focus:ring-brand-primary focus:outline-none transition-colors" />
            </div>
            <div>
                <label className="block text-sm font-medium text-text-secondary mb-1" htmlFor="negative-prompt">Negative Prompt</label>
                <textarea id="negative-prompt" value={negativePrompt} onChange={e => setNegativePrompt(e.target.value)} rows={2} placeholder="e.g., text, logos" className="w-full bg-background border border-border rounded-md px-3 py-2 text-text-primary focus:ring-2 focus:ring-brand-primary focus:outline-none transition-colors" />
            </div>
          </div>
        </fieldset>

        <div className="flex justify-end">
          <button type="submit" className="inline-flex items-center justify-center gap-2 font-semibold tracking-wide rounded-lg transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none text-white bg-gradient-to-br from-brand-primary to-brand-secondary shadow-md hover:shadow-lg hover:-translate-y-0.5 focus:ring-brand-primary text-base py-3 px-8">
            Connect & Scan Website
          </button>
        </div>
      </form>
    </div>
  );
};

export default ConfigurationStep;
