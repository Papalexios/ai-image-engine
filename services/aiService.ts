import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AIProvider, AnalysisAIConfig, Configuration, ImageAIConfig, ImageSettings, TextAIProvider, WordPressPost, AspectRatio } from '../types';

// --- Real AI Service using Google Gemini API ---

const getGeminiClient = (apiKey?: string) => {
  if (!apiKey) {
    throw new Error("Google Gemini API Key is missing. Please provide it in the configuration.");
  }
  return new GoogleGenAI({ apiKey });
};

const stripHtml = (html: string) => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || "";
};

/**
 * Extracts a JSON string from a text that might contain markdown code blocks or other text.
 * This makes parsing responses from non-standard models much more reliable.
 */
const extractJson = (text: string): string | null => {
    // First, try to find a JSON code block
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
        return codeBlockMatch[1].trim();
    }

    // If no code block, find the first '{' or '[' and the last '}' or ']'
    const firstBracket = text.indexOf('{');
    const firstSquare = text.indexOf('[');
    
    let startIndex = -1;
    // Determine the start of the JSON content
    if (firstBracket === -1) {
        startIndex = firstSquare;
    } else if (firstSquare === -1) {
        startIndex = firstBracket;
    } else {
        startIndex = Math.min(firstBracket, firstSquare);
    }

    if (startIndex === -1) {
        return null; // No JSON found
    }

    const lastBracket = text.lastIndexOf('}');
    const lastSquare = text.lastIndexOf(']');
    const endIndex = Math.max(lastBracket, lastSquare);

    if (endIndex === -1 || endIndex < startIndex) {
        return null; // No valid end found
    }

    return text.substring(startIndex, endIndex + 1).trim();
}

/**
 * A robust fetch wrapper that adds a timeout to network requests.
 * This is critical to prevent the application from hanging indefinitely.
 */
const fetchWithTimeout = async (resource: RequestInfo, options: RequestInit = {}, timeout = 90000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(resource, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        if (error instanceof DOMException && error.name === 'AbortError') {
            throw new Error(`Request timed out after ${timeout / 1000} seconds.`);
        }
        throw error;
    }
};


/**
 * Fetches an image from a URL and converts it to a base64 data URL.
 */
const fetchImageAsBase64 = async (imageUrl: string): Promise<string> => {
    const response = await fetchWithTimeout(imageUrl, {}, 30000); // 30 second timeout
    if (!response.ok) {
        throw new Error(`Failed to fetch image from URL: ${imageUrl}`);
    }
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

class FetchError extends Error {
    constructor(message: string, public status: number) {
        super(message);
        this.name = 'FetchError';
    }
}


/**
 * A helper function to retry an async function with exponential backoff,
 * specifically for handling API rate limiting from various providers.
 */
async function retryableAIOperation<T>(apiCall: () => Promise<T>, retries = 3, initialDelay = 2000): Promise<T> {
    let lastError: any;
    for (let i = 0; i < retries; i++) {
        try {
            return await apiCall();
        } catch (error) {
            lastError = error;
            const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
            const isRateLimitError = (error instanceof FetchError && error.status === 429) ||
                                     errorMessage.includes('429') ||
                                     errorMessage.includes('RESOURCE_EXHAUSTED');

            if (isRateLimitError) {
                const waitTime = initialDelay * Math.pow(2, i); // Exponential backoff
                console.warn(`AI rate limit hit. Retrying in ${waitTime / 1000}s... (Attempt ${i + 1}/${retries})`);
                await delay(waitTime);
            } else {
                // Not a rate limit error, rethrow immediately
                throw error;
            }
        }
    }
    throw new Error(`AI request failed after ${retries} attempts. Last error: ${lastError instanceof Error ? lastError.message : JSON.stringify(lastError)}`);
}

/**
 * Calls an OpenAI-compatible API endpoint for text generation.
 * This is now more robust and handles token limits correctly.
 */
const callOpenAICompatibleAPI = async (
    apiUrl: string,
    apiKey: string,
    model: string,
    prompt: string,
    maxTokens?: number,
    timeout?: number
): Promise<string> => {
    const body: any = {
        model: model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
    };
    if (maxTokens) {
        body.max_tokens = maxTokens;
    }

    const response = await fetchWithTimeout(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
    }, timeout); // Use the provided timeout, or the default from fetchWithTimeout

    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`OpenAI-compatible API Error (${response.status}):`, errorBody);
        throw new FetchError(`API request failed with status ${response.status}`, response.status);
    }

    const data = await response.json();
    
    // CRITICAL FIX: Prevent crash by checking API response structure.
    if (!data.choices || data.choices.length === 0 || !data.choices[0].message?.content) {
        console.error("Invalid or empty response from AI provider:", data);
        const finishReason = data.choices?.[0]?.finish_reason;
        if (finishReason === 'content_filter') {
            throw new Error("The AI provider blocked the response due to its safety filters.");
        }
        throw new Error("AI provider returned an empty or invalid response. This can happen if the model is overloaded or safety filters are triggered. Try a different model.");
    }

    return data.choices[0].message.content;
};


/**
 * Generic text generation function that routes to the correct provider.
 */
export const generateText = async (analysisConfig: AnalysisAIConfig, prompt: string, maxTokens?: number, timeout?: number): Promise<string> => {
    const { provider, apiKey, model } = analysisConfig;

    switch (provider) {
        case TextAIProvider.Gemini:
            const ai = getGeminiClient(apiKey);
            // Note: maxTokens is not easily mapped to Gemini's config and is ignored here for simplicity.
            // The primary bug was with OpenAI-compatible APIs.
            const response = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt });
            return response.text;

        case TextAIProvider.OpenAI:
            if (!apiKey) throw new Error("OpenAI API key is required.");
            return callOpenAICompatibleAPI('https://api.openai.com/v1/chat/completions', apiKey, 'gpt-4-turbo', prompt, maxTokens, timeout);
        
        case TextAIProvider.Groq:
            if (!apiKey) throw new Error("Groq API key is required.");
            if (!model) throw new Error("Groq model name is required.");
            return callOpenAICompatibleAPI('https://api.groq.com/openai/v1/chat/completions', apiKey, model, prompt, maxTokens, timeout);
            
        case TextAIProvider.OpenRouter:
            if (!apiKey) throw new Error("OpenRouter API key is required.");
            if (!model) throw new Error("OpenRouter model name is required.");
            return callOpenAICompatibleAPI('https://openrouter.ai/api/v1/chat/completions', apiKey, model, prompt, maxTokens, timeout);

        default:
            throw new Error(`Unsupported text provider: ${provider}`);
    }
};


/**
 * A specialized version of generateText that ensures the output is valid JSON,
 * handling provider-specific features like Gemini's responseSchema.
 */
const generateJsonText = async (analysisConfig: AnalysisAIConfig, prompt: string, schema?: any): Promise<string> => {
    const { provider } = analysisConfig;

    if (provider === TextAIProvider.Gemini) {
        const ai = getGeminiClient(analysisConfig.apiKey);
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: schema,
            },
        });
        return response.text;
    } else {
        // For other providers, add a strong instruction to the prompt
        const modifiedPrompt = `${prompt}\n\nIMPORTANT: Your response MUST be a valid JSON object (or array of objects) and nothing else. Do not include markdown formatting, code blocks, or any explanatory text.`;
        return await generateText(analysisConfig, modifiedPrompt);
    }
};


const BATCH_SIZE = 20; // Process 20 posts per API call
const DELAY_BETWEEN_BATCHES = 1000; // 1 second delay between batches

export const generateImageBriefsAndAltsBatch = async (
  posts: WordPressPost[],
  analysisConfig: AnalysisAIConfig,
  onProgress?: (processed: number, total: number) => void
): Promise<{ postId: number; brief: string; altText: string }[]> => {
  console.log(`Generating briefs for ${posts.length} posts using ${analysisConfig.provider}.`);
  let allResults: { postId: number; brief: string; altText: string }[] = [];
  
  onProgress?.(0, posts.length);

  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    const batch = posts.slice(i, i + BATCH_SIZE);
    
    console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(posts.length / BATCH_SIZE)}...`);

    const postsToAnalyze = batch.map(p => ({
      id: p.id,
      title: stripHtml(p.title.rendered),
      excerpt: stripHtml(p.excerpt.rendered),
    }));

    const briefPrompt = `You are an expert content assistant. Analyze the following WordPress posts and for each one, generate a concise, visually descriptive image brief and an SEO-friendly alt text.
        - The 'brief' should guide an AI image generator to create a relevant, high-quality image.
        - The 'altText' should describe the resulting image for accessibility and SEO.
        Posts: ${JSON.stringify(postsToAnalyze)}`;
        
    const briefSchema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          postId: { type: Type.NUMBER },
          brief: { type: Type.STRING },
          altText: { type: Type.STRING },
        },
        required: ["postId", "brief", "altText"]
      },
    };

    try {
        const responseText = await retryableAIOperation(() => generateJsonText(analysisConfig, briefPrompt, briefSchema));
        const jsonString = extractJson(responseText);

        if (!jsonString) {
            console.error("AI response did not contain valid JSON.", { provider: analysisConfig.provider, response: responseText });
            throw new Error(`The AI provider (${analysisConfig.provider}) returned a response that did not contain valid JSON.`);
        }

        const batchResults = JSON.parse(jsonString);
        allResults.push(...batchResults);
        onProgress?.(Math.min(i + BATCH_SIZE, posts.length), posts.length);

    } catch (error) {
        console.error(`Fatal error processing batch starting at index ${i}:`, error);
        if (error instanceof SyntaxError) {
          throw new Error(`The AI provider (${analysisConfig.provider}) returned malformed JSON, even after cleanup.`);
        }
        throw error;
    }


    if (i + BATCH_SIZE < posts.length) {
      await delay(DELAY_BETWEEN_BATCHES);
    }
  }

  return allResults;
};

const callOpenAICompatibleImageAPI = async (
    apiUrl: string,
    apiKey: string,
    model: string,
    prompt: string,
    aspectRatio: AspectRatio
): Promise<string> => {
    const sizeMap: Record<AspectRatio, string> = {
        [AspectRatio.Square]: '1024x1024',
        [AspectRatio.Landscape]: '1792x1024',
        [AspectRatio.Portrait]: '1024x1792',
    };

    const response = await fetchWithTimeout(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: model,
            prompt: prompt,
            n: 1,
            size: sizeMap[aspectRatio],
            response_format: 'b64_json',
        }),
    }, 120000); // 2 minute timeout for image generation

    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`OpenAI-compatible Image API Error (${response.status}):`, errorBody);
        throw new FetchError(`Image API request failed with status ${response.status}`, response.status);
    }
    const data = await response.json();
    if (!data.data || !data.data[0] || !data.data[0].b64_json) {
        throw new Error("Invalid response from image generation API.");
    }
    return `data:image/png;base64,${data.data[0].b64_json}`;
};

const callStabilityImageAPI = async (
    apiKey: string,
    model: string,
    prompt: string,
    aspectRatio: AspectRatio
): Promise<string> => {
    const response = await fetchWithTimeout(`https://api.stability.ai/v1/generation/${model}/text-to-image`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            text_prompts: [{ text: prompt }],
            cfg_scale: 7,
            samples: 1,
            steps: 30,
            aspect_ratio: aspectRatio,
        }),
    }, 120000);

    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`Stability API Error (${response.status}):`, errorBody);
        throw new FetchError(`Image API request failed with status ${response.status}`, response.status);
    }

    const data = await response.json();
    if (!data.artifacts || !data.artifacts[0] || !data.artifacts[0].base64) {
        throw new Error("Invalid response from Stability API.");
    }
    return `data:image/png;base64,${data.artifacts[0].base64}`;
};


export const generateImage = async (
  imageConfig: ImageAIConfig,
  prompt: string,
  settings: ImageSettings
): Promise<string> => {
  console.log(`Generating image with ${imageConfig.provider} for prompt: ${prompt}`);
  const { provider, apiKey, model } = imageConfig;
  
  if (!apiKey && provider !== AIProvider.Pollinations) {
    throw new Error(`API Key for ${provider} is required.`);
  }

  const operation = async () => {
    switch (provider) {
      case AIProvider.Gemini:
          const ai = getGeminiClient(apiKey);
          const response = await ai.models.generateImages({
              model: 'imagen-4.0-generate-001',
              prompt: prompt,
              config: {
                  numberOfImages: 1,
                  aspectRatio: settings.aspectRatio,
              },
          });
          const base64ImageBytes = response.generatedImages[0].image.imageBytes;
          return `data:image/png;base64,${base64ImageBytes}`;

      case AIProvider.DallE3:
          return callOpenAICompatibleImageAPI('https://api.openai.com/v1/images/generations', apiKey!, 'dall-e-3', prompt, settings.aspectRatio);

      case AIProvider.OpenRouter:
          if (!model) throw new Error("A model name is required for OpenRouter image generation.");
          return callOpenAICompatibleImageAPI('https://openrouter.ai/api/v1/images/generations', apiKey!, model, prompt, settings.aspectRatio);

      case AIProvider.Stability:
          if (!model) throw new Error("A model name (engine ID) is required for Stability AI.");
          return callStabilityImageAPI(apiKey!, model, prompt, settings.aspectRatio);

      case AIProvider.Pollinations:
          const imageUrl = `https://pollinations.ai/p/${encodeURIComponent(prompt)}`;
          return await fetchImageAsBase64(imageUrl);

      default:
          throw new Error(`${provider} is not implemented in this version.`);
    }
  };

  return await retryableAIOperation(operation);
};

/**
 * Fallback function to insert placeholder using a simple heuristic.
 * This is used if the AI fails or for very short posts.
 */
const insertPlaceholderHeuristically = (postContent: string, placeholder: string): string => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(postContent, 'text/html');
    const paragraphs = Array.from(doc.body.querySelectorAll('p'));

    // Find the first "significant" paragraph to insert after. Usually the 2nd or 3rd.
    let targetIndex = -1;
    if (paragraphs.length > 2) {
        targetIndex = 1; // After the 2nd paragraph
    } else if (paragraphs.length > 1) {
        targetIndex = 0; // After the 1st paragraph
    }

    if (targetIndex !== -1 && paragraphs[targetIndex]) {
        paragraphs[targetIndex].insertAdjacentHTML('afterend', `\n${placeholder}\n`);
    } else if (paragraphs.length > 0) {
        // Fallback: insert after the last paragraph if any exist
        paragraphs[paragraphs.length - 1].insertAdjacentHTML('afterend', `\n${placeholder}\n`);
    } else {
        // Absolute fallback: prepend to the content if no paragraphs found
        doc.body.innerHTML = `${placeholder}\n` + doc.body.innerHTML;
    }
    return doc.body.innerHTML;
};

/**
 * Hyper-efficiently finds the best place for an image by sending only a tiny
 * text snippet to an AI for a quick decision, with a robust heuristic fallback.
 */
export const getContentWithImagePlaceholder = async (analysisConfig: AnalysisAIConfig, postContent: string, postTitle: string): Promise<string> => {
    console.log(`Rapidly analyzing content (with title context) to find best image position using ${analysisConfig.provider}...`);
    const placeholder = '<!-- INSERT_IMAGE_HERE -->';
    const cleanTitle = stripHtml(postTitle);

    const parser = new DOMParser();
    const doc = parser.parseFromString(postContent, 'text/html');
    const paragraphs = Array.from(doc.body.querySelectorAll('p'));

    // If there are few paragraphs, no need for AI, just use the fast heuristic.
    if (paragraphs.length < 3) {
        console.log("Too few paragraphs, using simple heuristic for placement.");
        return insertPlaceholderHeuristically(postContent, placeholder);
    }
    
    try {
        // We only send the first few paragraphs' text to the AI, which is incredibly fast.
        const paragraphsToAnalyze = paragraphs.slice(0, 5)
            .map((p, index) => ({ num: index + 1, text: p.textContent?.trim() || '' }))
            .filter(p => p.text.length > 80); // Filter out very short paragraphs

        if (paragraphsToAnalyze.length < 2) {
            console.log("Not enough significant paragraphs for AI analysis, using heuristic.");
            return insertPlaceholderHeuristically(postContent, placeholder);
        }

        const prompt = `You are an expert in digital content layout and reader engagement. Your task is to find the most engaging and contextually appropriate location to insert an image within an article.
I will provide the article's title and its initial paragraphs, each numbered.

An image should be placed after a paragraph that either introduces a new concept, concludes an introductory section, or provides a natural pause for the reader. Avoid placing it after a very short paragraph or in the middle of a continuous thought. The goal is to break up the text visually and enhance the topic being discussed.

Article Title: "${cleanTitle}"

Paragraphs:
${paragraphsToAnalyze.map(p => `\n${p.num}. ${p.text}`).join('')}

Based on the title and paragraphs, which paragraph number is the absolute best place to insert an image IMMEDIATELY AFTER?
Respond with ONLY the paragraph number and nothing else.`;

        // Use shorter retries and a specific, small max token limit for this quick operation
        const responseText = await retryableAIOperation(() => generateText(analysisConfig, prompt, 10, 20000), 2, 500); // 20 second timeout
        const chosenParagraphNumber = parseInt(responseText.trim().match(/\d+/)?.[0] || '1', 10);
        
        // Validate the AI's response. Fallback to 1 (after 1st paragraph) if invalid.
        const targetParagraphIndex = isNaN(chosenParagraphNumber) || chosenParagraphNumber < 1 || chosenParagraphNumber > paragraphs.length
            ? 1 
            : chosenParagraphNumber - 1;

        console.log(`AI suggested inserting after paragraph ${targetParagraphIndex + 1}.`);

        if (paragraphs[targetParagraphIndex]) {
            paragraphs[targetParagraphIndex].insertAdjacentHTML('afterend', `\n${placeholder}\n`);
            return doc.body.innerHTML;
        } else {
            console.warn("AI chose an invalid paragraph index. Using heuristic fallback.");
            return insertPlaceholderHeuristically(postContent, placeholder);
        }

    } catch (error) {
        console.warn(`AI analysis for placement failed: ${error instanceof Error ? error.message : String(error)}. Falling back to robust heuristic placement.`);
        return insertPlaceholderHeuristically(postContent, placeholder);
    }
};

export const analyzeImageWithVision = async (geminiApiKey: string, imageUrl: string): Promise<{ score: number; altText: string; brief: string; }> => {
    console.log(`Analyzing image with AI Vision: ${imageUrl}`);
    const ai = getGeminiClient(geminiApiKey);

    const base64ImageData = await fetchImageAsBase64(imageUrl);
    const mimeType = base64ImageData.substring(base64ImageData.indexOf(":") + 1, base64ImageData.indexOf(";"));
    const data = base64ImageData.substring(base64ImageData.indexOf(",") + 1);

    const imagePart = {
        inlineData: { mimeType, data },
    };

    const response = await retryableAIOperation<GenerateContentResponse>(() => ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: {
            parts: [
                imagePart,
                { text: `You are an expert image analyst. Analyze the provided image and provide:
                1. A 'score' from 1-10 on its likely quality and relevance for a blog post.
                2. An improved, SEO-friendly 'altText'.
                3. A new creative 'brief' to guide regeneration if the current image is subpar.` },
            ]
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    score: { type: Type.NUMBER },
                    altText: { type: Type.STRING },
                    brief: { type: Type.STRING },
                },
                required: ["score", "altText", "brief"]
            }
        }
    }));
    
    try {
      return JSON.parse(response.text);
    } catch (e) {
      console.error("Failed to parse Gemini JSON response for vision analysis:", response.text);
      throw new Error("AI failed to generate valid analysis data.");
    }
};

/**
 * Translates a technical error from an AI provider into a more user-friendly message.
 */
const getFriendlyAIError = (error: unknown, provider: string): string => {
    let message = error instanceof Error ? error.message : 'An unknown error occurred.';
    if (message.includes('401') || message.toLowerCase().includes('api key') || message.toLowerCase().includes('authentication')) {
        message = `Authentication failed for ${provider}. Please check your API Key.`;
    } else if (message.includes('404')) {
        message = `Model not found for ${provider}. Please check the model name.`;
    } else if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
        message = `API rate limit exceeded for ${provider}. Please wait and try again.`;
    } else if (message.includes('timed out')) {
        message = `The request to ${provider} timed out. The service may be unavailable.`;
    }
    return message;
};


/**
 * Performs a lightweight test of a given text AI provider configuration.
 */
export const testTextAIProvider = async (config: AnalysisAIConfig): Promise<{ success: boolean, message: string }> => {
    try {
        if (!config.apiKey) throw new Error("API Key is required.");
        const testPrompt = "This is a connection test.";
        // generateText handles routing to Gemini, OpenAI, etc., and will throw on failure
        await generateText(config, testPrompt, 5, 20000); // 20 second timeout
        return { success: true, message: 'Connection successful.' };
    } catch (error) {
        return { success: false, message: getFriendlyAIError(error, config.provider) };
    }
};

/**
 * Performs a lightweight test of an image AI provider by checking credentials.
 */
export const testImageAIProvider = async (config: ImageAIConfig): Promise<{ success: boolean, message: string }> => {
    const { provider, apiKey, model } = config;
    try {
        if (!apiKey) throw new Error("API Key is required.");
        let testUrl: string;
        let options: RequestInit = {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${apiKey}` },
        };

        switch (provider) {
            case AIProvider.Gemini:
                // Gemini doesn't have a simple auth test endpoint, so we do a cheap text generation.
                return testTextAIProvider({ provider: TextAIProvider.Gemini, apiKey });
            case AIProvider.DallE3:
                testUrl = 'https://api.openai.com/v1/models';
                break;
            case AIProvider.OpenRouter:
                testUrl = 'https://openrouter.ai/api/v1/models';
                break;
            case AIProvider.Stability:
                testUrl = 'https://api.stability.ai/v1/user/balance';
                break;
            default:
                return { success: true, message: 'No test required.' };
        }
        
        const response = await fetchWithTimeout(testUrl, options, 20000); // 20s timeout
        if (!response.ok) {
            throw new FetchError(`API test failed with status ${response.status}`, response.status);
        }

        return { success: true, message: 'Connection successful.' };

    } catch (error) {
        return { success: false, message: getFriendlyAIError(error, provider) };
    }
};