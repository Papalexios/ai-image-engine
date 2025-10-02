import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { WordPressPost, Configuration } from '../types';
import PostCard from './PostCard';
import { generateImageBriefsAndAltsBatch, generateImage, getContentWithImagePlaceholder } from '../services/aiService';
import { uploadImage, updatePost, updateMediaAltText } from '../services/wordpressService';
import GenerationModal from './GenerationModal';
import AnalysisModal from './AnalysisModal';
import BulkAltTextModal from './BulkAltTextModal';
import { ImageIcon, SparklesIcon, UploadCloudIcon, CheckSquare, Square, EditIcon } from './icons/Icons';


const MAX_CONCURRENT_JOBS = 20;

type Job = {
  post: WordPressPost;
  action: 'generate' | 'insert' | 'set_featured';
  payload?: {
    imageUrl: string;
    altText: string;
  };
};

interface Props {
  initialPosts: WordPressPost[];
  config: Configuration;
  onReset: () => void;
}

const ResultsStep: React.FC<Props> = ({ initialPosts, config, onReset }) => {
  const [posts, setPosts] = useState<WordPressPost[]>(initialPosts);
  const [selectedPostIds, setSelectedPostIds] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState('all');
  
  const [jobQueue, setJobQueue] = useState<Job[]>([]);
  const [activeJobs, setActiveJobs] = useState<Job[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [totalModalJobs, setTotalModalJobs] = useState(0);

  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [postToAnalyze, setPostToAnalyze] = useState<WordPressPost | null>(null);

  const [isAltTextModalOpen, setIsAltTextModalOpen] = useState(false);

  useEffect(() => {
    if (isModalOpen && jobQueue.length === 0 && activeJobs.length === 0 && totalModalJobs > 0) {
      const timer = setTimeout(() => {
        setIsModalOpen(false);
        setTotalModalJobs(0);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isModalOpen, jobQueue.length, activeJobs.length, totalModalJobs]);

  const updatePostState = useCallback((postId: number, updates: Partial<WordPressPost>) => {
    setPosts(prevPosts => prevPosts.map(p => p.id === postId ? { ...p, ...updates } : p));
  }, []);

  const processJob = useCallback(async (job: Job) => {
    const { post, action, payload } = job;
    try {
      const currentPost = posts.find(p => p.id === post.id)!;
      
      if (action === 'generate') {
        updatePostState(post.id, { status: 'generating_brief', statusMessage: 'Analyzing content...' });
        const [briefData] = await generateImageBriefsAndAltsBatch([currentPost], config.ai.analysis);
        if (!briefData) throw new Error("Failed to generate image brief.");

        const fullPrompt = `${briefData.brief}, ${config.image.style}, ${config.image.negativePrompt ? `avoiding ${config.image.negativePrompt}` : ''}`;
        
        updatePostState(post.id, { status: 'generating_image', statusMessage: 'Creating image...' });
        const imageDataUrl = await generateImage(config.ai.provider, fullPrompt, config.image);
        
        updatePostState(post.id, { status: 'uploading', statusMessage: 'Uploading to WordPress...' });
        const uploadedImage = await uploadImage(config.wordpress, imageDataUrl, `ai-img-${post.id}.png`, briefData.altText, briefData.altText);
        
        const generatedImageData = {
          url: uploadedImage.source_url,
          mediaId: uploadedImage.id,
          alt: briefData.altText,
          brief: briefData.brief,
        };
        
        updatePostState(post.id, { status: 'success', statusMessage: 'Image generated!', generatedImage: generatedImageData });
      
      } else if (action === 'insert') {
        if (!payload?.imageUrl) throw new Error("No image URL provided for insertion.");
        
        updatePostState(post.id, { status: 'analyzing_placement', statusMessage: 'Finding best spot...' });
        
        const contentWithPlaceholder = await getContentWithImagePlaceholder(config.ai.analysis, currentPost.content.rendered, currentPost.title.rendered);
        
        const safeAltText = payload.altText.replace(/"/g, '&quot;');
        const imageHtml = `<figure class="wp-block-image size-large"><img src="${payload.imageUrl}" alt="${safeAltText}"/><figcaption>${payload.altText}</figcaption></figure>`;
        const newContent = contentWithPlaceholder.replace('<!-- INSERT_IMAGE_HERE -->', imageHtml);
        
        updatePostState(post.id, { status: 'inserting', statusMessage: 'Updating post...' });
        await updatePost(config.wordpress, post.id, { content: newContent });
        updatePostState(post.id, { status: 'success', statusMessage: 'Image inserted!', imageCount: currentPost.imageCount + 1, content: { ...currentPost.content, rendered: newContent } });

      } else if (action === 'set_featured') {
        if (!currentPost.generatedImage?.mediaId) throw new Error("No generated image media ID found to set as featured.");
        
        updatePostState(post.id, { status: 'setting_featured', statusMessage: 'Setting featured image...' });
        await updatePost(config.wordpress, post.id, { featured_media: currentPost.generatedImage.mediaId });
        updatePostState(post.id, { status: 'success', statusMessage: 'Featured image set!', featured_media: currentPost.generatedImage.mediaId });
      }

    } catch (error) {
      console.error(`Job failed for post ${post.id} with action ${action}:`, error);
      updatePostState(post.id, { status: 'error', statusMessage: error instanceof Error ? error.message : 'An unknown error occurred.' });
    }
  }, [posts, updatePostState, config]);
  
  useEffect(() => {
    const processQueue = () => {
        if (jobQueue.length > 0 && activeJobs.length < MAX_CONCURRENT_JOBS) {
            const nextJobs = jobQueue.slice(0, MAX_CONCURRENT_JOBS - activeJobs.length);
            const remainingQueue = jobQueue.slice(nextJobs.length);

            setJobQueue(remainingQueue);
            setActiveJobs(prev => [...prev, ...nextJobs]);

            nextJobs.forEach(job => {
                processJob(job).finally(() => {
                    setActiveJobs(prev => prev.filter(active => active.post.id !== job.post.id));
                });
            });
        }
    };
    processQueue();
  }, [jobQueue, activeJobs, processJob]);

  const addJobsToQueue = (jobs: Job[]) => {
    if (jobs.length === 0) return;
    setTotalModalJobs(prev => prev + jobs.length);
    setJobQueue(prev => [...prev, ...jobs]);
    setIsModalOpen(true);
  };

  const handleGenerate = (postsToProcess: WordPressPost[]) => {
    const jobs: Job[] = postsToProcess.map(p => ({ post: p, action: 'generate' }));
    addJobsToQueue(jobs);
  };
  
  const handleInsert = (post: WordPressPost) => {
    const imageToInsert = post.generatedImage
      ? { imageUrl: post.generatedImage.url, altText: post.generatedImage.alt }
      : post.existingImageUrl
      ? { imageUrl: post.existingImageUrl, altText: post.existingImageAltText || '' }
      : null;
      
    if (imageToInsert) {
      addJobsToQueue([{ post, action: 'insert', payload: imageToInsert }]);
    } else {
      alert("No image available to insert for this post.");
    }
  };

  const handleSetFeatured = (post: WordPressPost) => {
    addJobsToQueue([{ post, action: 'set_featured' }]);
  };

  const handleBulkInsertExisting = (postsToProcess: WordPressPost[]) => {
    const jobs: Job[] = postsToProcess
      .filter(p => p.existingImageUrl)
      .map(p => ({
        post: p,
        action: 'insert',
        payload: {
          imageUrl: p.existingImageUrl!,
          altText: p.existingImageAltText || '',
        },
      }));
    if (jobs.length > 0) {
      addJobsToQueue(jobs);
    } else {
        alert("None of the selected posts have an existing featured image to insert.");
    }
  };
  
  const handleToggleSelect = (postId: number) => {
    setSelectedPostIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  };

  const selectedPosts = useMemo(() => {
    return posts.filter(p => selectedPostIds.has(p.id));
  }, [posts, selectedPostIds]);
  
  const selectedPostsWithGeneratedImages = useMemo(() => {
    return selectedPosts.filter(p => p.generatedImage?.url);
  }, [selectedPosts]);

  const filteredPosts = useMemo(() => {
    if (filter === 'missing') {
      return posts.filter(p => p.featured_media === 0 || p.imageCount === 0);
    }
    if (filter === 'generated') {
        return posts.filter(p => !!p.generatedImage);
    }
    return posts;
  }, [posts, filter]);

  const handleSelectAll = () => {
    if (selectedPostIds.size === filteredPosts.length) {
        setSelectedPostIds(new Set());
    } else {
        setSelectedPostIds(new Set(filteredPosts.map(p => p.id)));
    }
  };

  const missingImagePosts = useMemo(() => posts.filter(p => !p.generatedImage && (p.featured_media === 0 || p.imageCount === 0)), [posts]);

  const handleAnalyze = (post: WordPressPost) => {
    setPostToAnalyze(post);
    setIsAnalysisModalOpen(true);
  };
  
  const handleGenerateForAllMissing = () => {
    if (window.confirm(`This will generate images for all ${missingImagePosts.length} posts that are missing one. This may consume a significant amount of API credits. Are you sure you want to proceed?`)) {
      handleGenerate(missingImagePosts);
    }
  };

  const handleSaveAltText = useCallback(async (updates: { mediaId: number; altText: string }[]) => {
    const postIdsToUpdate = new Set(
        posts.filter(p => p.generatedImage && updates.some(u => u.mediaId === p.generatedImage!.mediaId)).map(p => p.id)
    );
    posts.forEach(p => {
        if (postIdsToUpdate.has(p.id)) {
            updatePostState(p.id, { status: 'updating_meta', statusMessage: 'Saving alt text...' });
        }
    });

    const promises = updates.map(async ({ mediaId, altText }) => {
        try {
            await updateMediaAltText(config.wordpress, mediaId, altText);
            return { mediaId, altText, success: true, error: null };
        } catch (error) {
            console.error(`Failed to update alt text for media ${mediaId}:`, error);
            return { mediaId, altText: '', success: false, error: error instanceof Error ? error.message : 'Update failed' };
        }
    });

    const results = await Promise.all(promises);

    setPosts(prev => prev.map(p => {
        if (!p.generatedImage) return p;
        const result = results.find(r => r.mediaId === p.generatedImage!.mediaId);
        if (!result) return p;

        if (result.success) {
            return {
                ...p,
                status: 'success',
                statusMessage: 'Alt text updated!',
                generatedImage: { ...p.generatedImage, alt: result.altText }
            };
        } else {
            return {
                ...p,
                status: 'error',
                statusMessage: `Failed to update alt text: ${result.error}`
            };
        }
    }));

    setIsAltTextModalOpen(false);
  }, [config.wordpress, posts, updatePostState, setPosts]);
  
  const handleClearCompleted = () => {
      setJobQueue([]);
      setActiveJobs([]);
      setTotalModalJobs(0);
  };

  const handleModalClose = () => {
      setIsModalOpen(false);
      if (jobQueue.length === 0 && activeJobs.length === 0) {
          setTotalModalJobs(0);
      }
  };

  return (
    <div className="animate-fade-in">
      {isModalOpen && (
        <GenerationModal 
            posts={activeJobs.map(j => j.post).concat(jobQueue.map(j => j.post))} 
            totalJobs={totalModalJobs}
            onClose={handleModalClose}
            onClearCompleted={handleClearCompleted}
        />
      )}
      {isAnalysisModalOpen && postToAnalyze && (
        <AnalysisModal 
            post={postToAnalyze}
            config={config}
            onClose={() => setIsAnalysisModalOpen(false)}
            onUpdatePost={updatePostState}
            onRegenerate={(post) => handleGenerate([post])}
        />
      )}
      {isAltTextModalOpen && (
        <BulkAltTextModal
          posts={selectedPostsWithGeneratedImages}
          onClose={() => setIsAltTextModalOpen(false)}
          onSave={handleSaveAltText}
        />
      )}

      <div className="bg-surface rounded-lg shadow-xl p-4 sm:p-6 border border-border">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <div>
            <h2 className="text-2xl font-bold text-text-primary">Post Dashboard</h2>
            <p className="text-text-secondary">{filteredPosts.length} posts found. {selectedPostIds.size} selected.</p>
          </div>
          <button onClick={onReset} className="inline-flex items-center justify-center gap-2 text-sm font-semibold tracking-wide py-2.5 px-4 rounded-lg transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface-muted disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none bg-surface-muted text-text-secondary hover:bg-border">
            Start Over
          </button>
        </div>
        
        <div className="bg-surface-muted/60 p-3 rounded-lg border border-border mb-4 flex flex-col md:flex-row items-start md:items-center gap-4 shadow-sm">
            <div className="flex items-center gap-4">
                <button onClick={handleSelectAll} className="flex items-center space-x-2 p-2 rounded-md hover:bg-border transition-colors">
                    {selectedPostIds.size === filteredPosts.length && filteredPosts.length > 0 ? <CheckSquare className="w-6 h-6 text-brand-primary"/> : <Square className="w-6 h-6 text-subtle"/>}
                    <span className="font-semibold text-text-primary">
                        {selectedPostIds.size > 0 ? `${selectedPostIds.size} Selected` : 'Select All'}
                    </span>
                </button>
                <div className="w-px h-8 bg-border"></div>
            </div>
            <div className="flex-grow flex flex-wrap items-center gap-x-4 gap-y-2">
                 <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold uppercase text-muted tracking-wider mr-2">Actions</span>
                    <button disabled={selectedPosts.length === 0} onClick={() => handleGenerate(selectedPosts)} className="inline-flex items-center justify-center gap-2 text-sm font-semibold tracking-wide py-2.5 px-4 rounded-lg transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface-muted disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none text-white bg-gradient-to-br from-brand-primary to-brand-secondary shadow hover:shadow-md hover:-translate-y-0.5 focus:ring-brand-primary">
                        <SparklesIcon className="w-5 h-5"/> <span>Generate Images</span>
                    </button>
                    <button disabled={selectedPosts.length === 0} onClick={() => handleBulkInsertExisting(selectedPosts)} className="inline-flex items-center justify-center gap-2 text-sm font-semibold tracking-wide py-2.5 px-4 rounded-lg transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface-muted disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none bg-surface text-text-secondary border border-border shadow-sm hover:border-brand-primary hover:text-brand-primary hover:shadow focus:ring-brand-primary">
                        <ImageIcon className="w-5 h-5"/> <span>Insert Existing Images</span>
                    </button>
                    <button disabled={missingImagePosts.length === 0} onClick={handleGenerateForAllMissing} className="inline-flex items-center justify-center gap-2 text-sm font-semibold tracking-wide py-2.5 px-4 rounded-lg transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface-muted disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none text-white bg-gradient-to-br from-special-start to-special-end shadow-md hover:shadow-lg hover:-translate-y-0.5 focus:ring-special-start disabled:from-slate-400 disabled:to-slate-500 animate-subtle-pulse">
                        <SparklesIcon className="w-5 h-5"/> <span>Generate For All Missing ({missingImagePosts.length})</span>
                    </button>
                </div>
                
                <div className="w-px h-8 bg-border hidden md:block"></div>

                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold uppercase text-muted tracking-wider mr-2">Manage</span>
                    <button disabled={selectedPostsWithGeneratedImages.length === 0} onClick={() => setIsAltTextModalOpen(true)} className="inline-flex items-center justify-center gap-2 text-sm font-semibold tracking-wide py-2.5 px-4 rounded-lg transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface-muted disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none bg-surface text-text-secondary border border-border shadow-sm hover:border-brand-primary hover:text-brand-primary hover:shadow focus:ring-brand-primary">
                        <EditIcon className="w-5 h-5"/> <span>Edit Alt Text</span>
                    </button>
                </div>
            </div>
        </div>


        <div className="flex items-center space-x-2 mb-4">
            <button onClick={() => setFilter('all')} className={`px-4 py-1.5 text-sm font-medium rounded-full text-text-secondary bg-surface-muted/60 hover:bg-border transition-colors ${filter === 'all' ? 'bg-brand-primary text-white hover:bg-brand-secondary shadow' : ''}`}>All Posts</button>
            <button onClick={() => setFilter('missing')} className={`px-4 py-1.5 text-sm font-medium rounded-full text-text-secondary bg-surface-muted/60 hover:bg-border transition-colors ${filter === 'missing' ? 'bg-brand-primary text-white hover:bg-brand-secondary shadow' : ''}`}>Missing Images</button>
            <button onClick={() => setFilter('generated')} className={`px-4 py-1.5 text-sm font-medium rounded-full text-text-secondary bg-surface-muted/60 hover:bg-border transition-colors ${filter === 'generated' ? 'bg-brand-primary text-white hover:bg-brand-secondary shadow' : ''}`}>Generated Images</button>
        </div>


        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredPosts.map(post => (
            <PostCard 
              key={post.id} 
              post={post}
              isSelected={selectedPostIds.has(post.id)}
              onToggleSelect={() => handleToggleSelect(post.id)}
              onGenerate={() => handleGenerate([post])}
              onInsert={() => handleInsert(post)}
              onSetFeatured={() => handleSetFeatured(post)}
              onAnalyze={() => handleAnalyze(post)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ResultsStep;