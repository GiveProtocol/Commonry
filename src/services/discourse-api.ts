/**
 * Discourse API Integration
 *
 * This module provides functions to fetch data from Discourse forum API.
 * Used to display recent activity and forum stats on The Square page.
 *
 * @see https://docs.discourse.org/#tag/Posts
 */

const API_BASE_URL =
  import.meta.env.VITE_DISCOURSE_URL || "https://forum.commonry.app";
const API_KEY = import.meta.env.VITE_DISCOURSE_API_KEY; // Optional, for higher rate limits

export interface DiscoursePost {
  id: number;
  username: string;
  avatar_template: string;
  created_at: string;
  cooked: string; // HTML content
  topic_id: number;
  topic_slug: string;
  topic_title: string;
  post_number: number;
  reply_count: number;
  like_count: number;
}

export interface DiscourseTopic {
  id: number;
  title: string;
  slug: string;
  posts_count: number;
  reply_count: number;
  views: number;
  like_count: number;
  created_at: string;
  last_posted_at: string;
  category_id: number;
  posters: Array<{
    user_id: number;
    description: string;
  }>;
}

export interface DiscourseCategory {
  id: number;
  name: string;
  slug: string;
  topic_count: number;
  post_count: number;
  description: string;
  color: string;
}

/**
 * Fetch recent posts from Discourse forum
 *
 * @param limit - Number of posts to fetch (default: 10)
 * @returns Promise resolving to array of recent posts
 */
export async function getRecentPosts(limit = 10): Promise<DiscoursePost[]> {
  try {
    const url = new URL(`${API_BASE_URL}/posts.json`);

    const headers: HeadersInit = {
      Accept: "application/json",
    };

    if (API_KEY) {
      headers["Api-Key"] = API_KEY;
    }

    const response = await fetch(url.toString(), { headers });

    if (!response.ok) {
      console.error(
        "Failed to fetch Discourse posts:",
        response.statusText.replace(/[\n\r]/g, ""),
      );
      return [];
    }

    const data = await response.json();
    return data.latest_posts?.slice(0, limit) || [];
  } catch (error) {
    console.error(
      "Error fetching Discourse posts:",
      error?.toString().replace(/[\n\r]/g, ""),
    );
    return [];
  }
}

/**
 * Fetch latest topics from Discourse forum
 *
 * @param limit - Number of topics to fetch (default: 10)
 * @returns Promise resolving to array of latest topics
 */
export async function getLatestTopics(limit = 10): Promise<DiscourseTopic[]> {
  try {
    const url = new URL(`${API_BASE_URL}/latest.json`);

    const headers: HeadersInit = {
      Accept: "application/json",
    };

    if (API_KEY) {
      headers["Api-Key"] = API_KEY;
    }

    const response = await fetch(url.toString(), { headers });

    if (!response.ok) {
      const sanitizedStatusText = response.statusText.replace(/[\n\r]/g, "");
      console.error("Failed to fetch Discourse topics:", sanitizedStatusText);
      return [];
    }

    const data = await response.json();
    return data.topic_list?.topics.slice(0, limit) || [];
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const sanitizedErrorMsg = errorMsg.replace(/[\n\r]/g, "");
    console.error("Error fetching Discourse topics:", sanitizedErrorMsg);
    return [];
  }
}

/**
 * Fetch forum categories
 *
 * @returns Promise resolving to array of categories
 */
export async function getCategories(): Promise<DiscourseCategory[]> {
  try {
    const url = new URL(`${API_BASE_URL}/categories.json`);

    const headers: HeadersInit = {
      Accept: "application/json",
    };

    if (API_KEY) {
      headers["Api-Key"] = API_KEY;
    }

    const response = await fetch(url.toString(), { headers });

    if (!response.ok) {
      const sanitizedStatusText = response.statusText.replace(/[\n\r]/g, "");
      console.error(
        "Failed to fetch Discourse categories:",
        sanitizedStatusText,
      );
      return [];
    }

    const data = await response.json();
    return data.category_list?.categories || [];
  } catch (error) {
    const sanitizedError = String(error).replace(/[\n\r]/g, "");
    console.error("Error fetching Discourse categories:", sanitizedError);
    return [];
  }
}

/**
 * Get the avatar URL for a Discourse user
 *
 * @param avatarTemplate - The avatar_template from Discourse API
 * @param size - Avatar size (default: 45)
 * @returns Complete avatar URL
 */
export function getAvatarUrl(avatarTemplate: string, size = 45): string {
  return `${API_BASE_URL}${avatarTemplate.replace("{size}", size.toString())}`;
}

/**
 * Get the URL for a specific topic
 *
 * @param topicId - Topic ID
 * @param slug - Topic slug
 * @returns Complete topic URL
 */
export function getTopicUrl(topicId: number, slug: string): string {
  return `${API_BASE_URL}/t/${slug}/${topicId}`;
}

/**
 * Initiates the SSO login flow to Discourse
 * Redirects user to backend SSO endpoint which handles the Discourse auth
 *
 * @param token - User's Commonry auth token
 */
export function loginToForum(token: string): void {
  // Redirect to our backend SSO endpoint with auth token
  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
  window.location.href = `${apiBaseUrl}/api/discourse/sso?token=${encodeURIComponent(token)}`;
}
