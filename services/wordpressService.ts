
import { WordPressPost } from '../types';

// --- Real WordPress Service using Fetch API ---

/**
 * A helper function to handle authenticated requests to the WordPress REST API.
 */
const wpFetch = async (
  baseUrl: string,
  endpoint: string,
  username: string,
  appPassword?: string,
  options: RequestInit = {}
) => {
  const url = `${baseUrl.replace(/\/$/, "")}/wp-json/wp/v2${endpoint}`;
  const headers = new Headers(options.headers || {});
  
  if (username && appPassword) {
    headers.set('Authorization', `Basic ${btoa(`${username}:${appPassword}`)}`);
  }
  
  if (options.body instanceof FormData) {
    // Let the browser set the Content-Type for FormData
  } else if (options.body) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('WP API Error:', errorBody);
    throw new Error(`WordPress API request failed with status ${response.status}: ${response.statusText}`);
  }

  return response;
};


export const getTotalPosts = async (url: string, user: string, pass?: string): Promise<number> => {
  console.log('Fetching total posts from:', url, 'with user:', user);
  if (!url || !user) throw new Error("URL and Username are required.");
  
  // Fetching just one post is the most efficient way to get the total count from the headers.
  const response = await wpFetch(url, '/posts?per_page=1', user, pass);
  const total = response.headers.get('X-WP-Total');
  
  if (total === null) {
      console.warn("X-WP-Total header not found. Crawling may be incomplete.");
      return 0;
  }
  return parseInt(total, 10);
};

export const fetchPosts = async (url: string, user: string, pass: string | undefined, page: number, perPage: number): Promise<WordPressPost[]> => {
  console.log(`Fetching page ${page} from:`, url);
  // _embed allows fetching related data like featured images in the same request.
  const response = await wpFetch(url, `/posts?per_page=${perPage}&page=${page}&_embed=wp:featuredmedia`, user, pass);
  const data: any[] = await response.json();

  return data.map(post => {
    // Count existing images in content
    const doc = new DOMParser().parseFromString(post.content.rendered, 'text/html');
    const imageCount = doc.getElementsByTagName('img').length;
    
    const featuredMedia = post._embedded?.['wp:featuredmedia']?.[0];
    const existingImageUrl = featuredMedia?.source_url;
    const existingImageAltText = featuredMedia?.alt_text;

    return {
      id: post.id,
      title: post.title,
      link: post.link,
      excerpt: post.excerpt,
      content: post.content,
      featured_media: post.featured_media,
      imageCount: imageCount,
      existingImageUrl: existingImageUrl,
      existingImageAltText: existingImageAltText,
      status: 'idle',
    };
  });
};

export const uploadImage = async (
  config: { url: string, username: string, appPassword?: string },
  imageDataUrl: string,
  fileName: string,
  altText: string,
  caption: string
): Promise<{ id: number, source_url: string }> => {
  console.log(`Uploading ${fileName} to ${config.url}`);
  
  // Convert base64 data URL to a Blob for uploading
  const response = await fetch(imageDataUrl);
  const blob = await response.blob();

  const formData = new FormData();
  formData.append('file', blob, fileName);
  formData.append('alt_text', altText);
  formData.append('caption', caption);
  formData.append('title', fileName.split('.').slice(0, -1).join(' ')); // Use filename as title

  const apiResponse = await wpFetch(config.url, '/media', config.username, config.appPassword, {
    method: 'POST',
    body: formData,
  });

  const mediaDetails = await apiResponse.json();
  
  return {
    id: mediaDetails.id,
    source_url: mediaDetails.source_url,
  };
};

export const updatePost = async (
  config: { url:string, username: string, appPassword?: string },
  postId: number,
  update: { content?: string, featured_media?: number }
): Promise<WordPressPost> => {
    console.log(`Updating post ${postId} on ${config.url} with`, update);
    const response = await wpFetch(config.url, `/posts/${postId}`, config.username, config.appPassword, {
        method: 'POST',
        body: JSON.stringify(update),
    });
    return response.json();
};

export const updateMediaAltText = async (
    config: { url:string, username: string, appPassword?: string },
    mediaId: number,
    altText: string
): Promise<void> => {
    console.log(`Updating alt text for media item ${mediaId} on ${config.url} to: "${altText}"`);
    await wpFetch(config.url, `/media/${mediaId}`, config.username, config.appPassword, {
        method: 'POST',
        body: JSON.stringify({ alt_text: altText }),
    });
    return;
}