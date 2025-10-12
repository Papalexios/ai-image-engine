import React, 'react';
import { useState, useCallback, useMemo } from 'react';
import { Configuration, AIProvider, ImageFormat, AspectRatio, TextAIProvider, AnalysisAIConfig, ImageAIConfig } from '../types';
import { EyeIcon, EyeOffIcon, InfoIcon, ZapIcon, Loader, AlertTriangle, CheckCircle2 } from './icons/Icons';
import { getTotalPosts } from '../services/wordpressService';
import { testTextAIProvider, testImageAIProvider } from '../services/aiService';

interface Props {
  onConfigure: (config: Configuration) => void;
}

type TestResult = { success: boolean; message: string };
type TestResults = Record<string, TestResult>;

// Maps providers to a single key holder (e.g., DALL-E 3 and OpenAI GPT use the same 'OpenAI' key)
const KEY_HOLDER_MAP: Record<string, string> = {
    [AIProvider.Gemini]: 'Google Gemini',
    [TextAIProvider.Gemini]: 'Google Gemini',
    [AIProvider.DallE3]: 'OpenAI',
    [TextAIProvider.OpenAI]: 'OpenAI',
    [AIProvider.Stability]: 'Stability AI',
    [AIProvider.OpenRouter]: 'OpenRouter',
    [TextAIProvider.OpenRouter]: 'OpenRouter',
    [TextAIProvider.Groq]: 'Groq',
};

const ConfigurationStep: React.FC<Props> = ({ onConfigure }) => {
  // WordPress State
  const [wpUrl, setWpUrl] = useState('');
  const [wpUser, setWpUser] = useState('');
  const [wpPass, setWpPass] = useState('');
  const [showPass, setShowPass] = useState(false);

  // AI Provider State
  const [imageProvider, setImageProvider] = useState<AIProvider>(AIProvider.Gemini);
  const [analysisProvider, setAnalysisProvider] = useState<TextAIProvider>(TextAIProvider.Gemini);
  
  // Model Name State
  const [imageModel, setImageModel] = useState('stable-diffusion-v1-6');
  const [analysisModel, setAnalysisModel] = useState('llama3-8b-8192');

  // Unified API Key State
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});

  // Image Settings State
  const [imageFormat, setImageFormat] = useState<ImageFormat>(ImageFormat.WebP);
  const [quality, setQuality] = useState(85);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.Landscape);
  const [style, setStyle] = useState('photorealistic, cinematic, high detail');
  const [negativePrompt, setNegativePrompt] = useState('text, logos, watermarks, blurry');
  
  // Testing State
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState<TestResults>({});

  const requiredKeyHolders = useMemo(() => {
    const holders = new Set<string>();
    if (imageProvider !== AIProvider.Pollinations) {
        holders.add(KEY_HOLDER_MAP[imageProvider]);
    }
    holders.add(KEY_HOLDER_MAP[analysisProvider]);
    return Array.from(holders);
  }, [imageProvider, analysisProvider]);

  const getApiKeyForProvider = useCallback((provider: AIProvider | TextAIProvider) => {
    const holder = KEY_HOLDER_MAP[provider];
    return holder ? apiKeys[holder] : undefined;
  }, [apiKeys]);
  
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!wpUrl || !wpUser || !wpPass) {
        alert("WordPress Site URL, Username, and Application Password are required.");
        return;
    }
    // Check if any required API key is missing
    for (const holder of requiredKeyHolders) {
        if (!apiKeys[holder]) {
            alert(`${holder} API Key is required.`);
            return;
        }
    }

    onConfigure({
      wordpress: { url: wpUrl, username: wpUser, appPassword: wpPass },
      ai: { 
          image: {
              provider: imageProvider,
              apiKey: getApiKeyForProvider(imageProvider),
              model: imageModel,
          },
          analysis: {
              provider: analysisProvider,
              apiKey: getApiKeyForProvider(analysisProvider),
              model: analysisModel
          }
      },
      image: { format: imageFormat, quality, aspectRatio, style, negativePrompt },
    });
  }, [wpUrl, wpUser, wpPass, imageProvider, imageFormat, quality, aspectRatio, style, negativePrompt, onConfigure, analysisProvider, analysisModel, imageModel, apiKeys, requiredKeyHolders, getApiKeyForProvider]);
  
  const handleTestConnections = async () => {
    setIsTesting(true);
    setTestResults({});

    const promises: Record<string, Promise<TestResult>> = {};

    // WordPress Test
    promises['WordPress'] = getTotalPosts(wpUrl, wpUser, wpPass)
        .then(() => ({ success: true, message: 'WordPress connection successful!' }))
        .catch(err => ({ success: false, message: err instanceof Error ? err.message : 'An unknown WP error occurred.' }));

    // Image Provider Test
    const imageConfig: ImageAIConfig = {
      provider: imageProvider,
      apiKey: getApiKeyForProvider(imageProvider),
      model: imageModel,
    };
    if (imageProvider !== AIProvider.Pollinations) {
      promises[imageProvider] = testImageAIProvider(imageConfig);
    }
    
    // Analysis Provider Test
    const analysisConfig: AnalysisAIConfig = {
        provider: analysisProvider,
        apiKey: getApiKeyForProvider(analysisProvider),
        model: analysisModel,
    };
    // Only test if it's a different provider OR a different key holder than the image provider
    if (imageProvider !== analysisProvider || KEY_HOLDER_MAP[imageProvider] !== KEY_HOLDER_MAP[analysisProvider]) {
      promises[analysisProvider] = testTextAIProvider(analysisConfig);
    }

    const results = await Promise.all(Object.values(promises));
    const newTestResults: TestResults = {};
    Object.keys(promises).forEach((key, index) => {
        newTestResults[key] = results[index];
    });

    setTestResults(newTestResults);
    setIsTesting(false);
  };

  const TestResultIndicator: React.FC<{ result?: TestResult }> = ({ result }) => {
    if (!result) return null;
    return (
        <div className={`flex items-center space-x-2 text-xs font-semibold mt-2 ml-1 ${result.success ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
            {result.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span>{result.message}</span>
        </div>
    );
  };

  return (
    <div className="bg-surface rounded-lg shadow-xl p-6 sm:p-8 max-w-4xl mx-auto animate-fade-in border border-border">
      <h2 className="text-2xl font-bold text-text-primary mb-2">Welcome to the AI Image Engine</h2>
      <p className="text-text-secondary mb-6">Start by configuring your WordPress site and AI providers.</p>
      
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* WordPress Settings */}
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
            <TestResultIndicator result={testResults['WordPress']} />
        </fieldset>

        {/* AI Provider Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <fieldset className="border border-border p-4 rounded-lg">
                <legend className="text-lg font-semibold text-brand-primary px-2">Image Generation</legend>
                <div className="space-y-4">
                  <div>
                      <label className="block text-sm font-medium text-text-secondary mb-1" htmlFor="ai-provider">Provider</label>
                      <select id="ai-provider" value={imageProvider} onChange={e => setImageProvider(e.target.value as AIProvider)} className="w-full bg-background border border-border rounded-md px-3 py-2 text-text-primary focus:ring-2 focus:ring-brand-primary focus:outline-none transition-colors">
                      {Object.values(AIProvider).map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                  </div>
                   {(imageProvider === AIProvider.OpenRouter || imageProvider === AIProvider.Stability) && (
                         <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1" htmlFor="image-model">Model Name</label>
                            <input id="image-model" type="text" value={imageModel} onChange={e => setImageModel(e.target.value)} placeholder="e.g., stable-diffusion-v1-6" required className="w-full bg-background border border-border rounded-md px-3 py-2 text-text-primary focus:ring-2 focus:ring-brand-primary focus:outline-none transition-colors" />
                        </div>
                    )}
                 <TestResultIndicator result={testResults[imageProvider]} />
                </div>
            </fieldset>

            <fieldset className="border border-border p-4 rounded-lg">
                <legend className="text-lg font-semibold text-brand-primary px-2">Content Analysis</legend>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1" htmlFor="analysis-provider">Provider</label>
                        <select id="analysis-provider" value={analysisProvider} onChange={e => setAnalysisProvider(e.target.value as TextAIProvider)} className="w-full bg-background border border-border rounded-md px-3 py-2 text-text-primary focus:ring-2 focus:ring-brand-primary focus:outline-none transition-colors">
                            {Object.values(TextAIProvider).map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                     <p className="text-xs text-muted flex items-start space-x-1.5">
                        <InfoIcon className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span>This AI finds the best spot to insert an image.</span>
                    </p>
                    {(analysisProvider === TextAIProvider.Groq || analysisProvider === TextAIProvider.OpenRouter) && (
                         <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1" htmlFor="analysis-model">Model Name</label>
                            <input id="analysis-model" type="text" value={analysisModel} onChange={e => setAnalysisModel(e.target.value)} placeholder="e.g., llama3-8b-8192" required className="w-full bg-background border border-border rounded-md px-3 py-2 text-text-primary focus:ring-2 focus:ring-brand-primary focus:outline-none transition-colors" />
                        </div>
                    )}
                    <TestResultIndicator result={testResults[analysisProvider]} />
                </div>
            </fieldset>
        </div>
        
        {requiredKeyHolders.length > 0 && (
            <fieldset className="border border-border p-4 rounded-lg">
                <legend className="text-lg font-semibold text-brand-primary px-2">API Keys</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {requiredKeyHolders.map(holder => (
                        <div key={holder}>
                            <label className="block text-sm font-medium text-text-secondary mb-1" htmlFor={`api-key-${holder}`}>{holder} API Key</label>
                            <input 
                                id={`api-key-${holder}`} 
                                type="password" 
                                value={apiKeys[holder] || ''} 
                                onChange={e => setApiKeys(prev => ({...prev, [holder]: e.target.value}))} 
                                placeholder={`Enter your ${holder} API Key`} 
                                required 
                                className="w-full bg-background border border-border rounded-md px-3 py-2 text-text-primary focus:ring-2 focus:ring-brand-primary focus:outline-none transition-colors" 
                            />
                        </div>
                    ))}
                </div>
            </fieldset>
        )}


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

        <div className="flex justify-end items-center gap-4">
          <button type="button" onClick={handleTestConnections} disabled={isTesting} className="inline-flex items-center justify-center gap-2 font-semibold tracking-wide rounded-lg transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface disabled:opacity-50 disabled:cursor-not-allowed bg-surface text-text-secondary border border-border shadow-sm hover:border-brand-primary hover:text-brand-primary hover:shadow focus:ring-brand-primary text-base py-3 px-6">
            {isTesting ? <Loader className="w-5 h-5 animate-spin" /> : <ZapIcon className="w-5 h-5" />}
            <span>Test Connections</span>
          </button>
          <button type="submit" className="inline-flex items-center justify-center gap-2 font-semibold tracking-wide rounded-lg transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none text-white bg-gradient-to-br from-brand-primary to-brand-secondary shadow-md hover:shadow-lg hover:-translate-y-0.5 focus:ring-brand-primary text-base py-3 px-8">
            Connect & Scan Website
          </button>
        </div>
      </form>
    </div>
  );
};

export default ConfigurationStep;