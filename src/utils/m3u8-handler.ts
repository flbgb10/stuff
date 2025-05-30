import { URL } from 'url';
import fetch from 'node-fetch';
import https from 'https';

/**
 * Interface for M3U8 handler options
 */
export interface M3u8HandlerOptions {
  proxyBaseUrl: string;
  targetUrl: string;
  urlParamName?: string;
  preserveQueryParams?: boolean;
}

// HTTPS agent that bypasses certificate errors
const insecureAgent = new https.Agent({
  rejectUnauthorized: false
});

/**
 * Downloads M3U8 content with bypassed cert verification
 * @param url Full M3U8 URL
 * @returns M3U8 content as string
 */
export async function fetchM3u8Content(url: string): Promise<string> {
  const response = await fetch(url, {
    agent: insecureAgent
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch M3U8 content: ${response.statusText}`);
  }

  return await response.text();
}

/**
 * Processes an M3U8 playlist to rewrite URLs through the proxy
 * @param content The M3U8 content as string
 * @param options Handler options
 * @returns Processed M3U8 content with rewritten paths
 */
export function processM3u8Content(
  content: string,
  options: M3u8HandlerOptions
): string {
  const {
    proxyBaseUrl,
    targetUrl,
    urlParamName = 'url',
  } = options;

  try {
    const targetUrlObj = new URL(targetUrl);

    let basePath = targetUrl;
    if (targetUrl.endsWith('.m3u8')) {
      basePath = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
    } else if (!basePath.endsWith('/')) {
      basePath += '/';
    }

    const lines = content.split(/\r?\n/);
    const processedLines = lines.map(line => {
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith('#')) {
        if (line.includes('URI="')) {
          const uriMatch = line.match(/URI="([^"]+)"/);
          if (uriMatch && uriMatch[1]) {
            const originalUri = uriMatch[1];
            let absoluteUri: string;

            if (originalUri.startsWith('http://') || originalUri.startsWith('https://')) {
              absoluteUri = originalUri;
            } else {
              absoluteUri = new URL(originalUri, basePath).toString();
            }

            const proxyUrl = `${proxyBaseUrl}?${urlParamName}=${encodeURIComponent(absoluteUri)}`;
            return line.replace(/URI="([^"]+)"/, `URI="${proxyUrl}"`);
          }
        }

        return line;
      }

      if (trimmedLine.length > 0) {
        if (trimmedLine.startsWith(proxyBaseUrl)) {
          return line;
        }

        let absoluteUrl: string;
        if (trimmedLine.startsWith('http://') || trimmedLine.startsWith('https://')) {
          absoluteUrl = trimmedLine;
        } else if (trimmedLine.startsWith('//')) {
          absoluteUrl = `${targetUrlObj.protocol}${trimmedLine}`;
        } else {
          absoluteUrl = new URL(trimmedLine, basePath).toString();
        }

        return `${proxyBaseUrl}?${urlParamName}=${encodeURIComponent(absoluteUrl)}`;
      }

      return line;
    });

    return processedLines.join('\n');
  } catch (error) {
    console.error('Error processing M3U8 content:', error);
    return content;
  }
}

/**
 * Generates a proxy URL for a given target URL
 * @param proxyBaseUrl The base URL of the proxy
 * @param targetUrl The target URL to proxy
 * @param urlParamName The query parameter name for the URL
 * @returns The proxy URL
 */
export function generateProxyUrl(
  proxyBaseUrl: string,
  targetUrl: string,
  urlParamName: string = 'url'
): string {
  return `${proxyBaseUrl}?${urlParamName}=${encodeURIComponent(targetUrl)}`;
}

export default {
  processM3u8Content,
  generateProxyUrl,
  fetchM3u8Content
};
