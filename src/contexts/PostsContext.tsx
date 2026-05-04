import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { AuditPost } from "@/data/mockData";
import { api } from "@/utils/supabase/client";

interface PostsContextType {
  posts: AuditPost[];
  loadPostThumbnails: (postIds: string[]) => Promise<void>;
  addPost: (post: AuditPost) => Promise<void>;
  updatePost: (
    postId: string,
    updatedPost: AuditPost,
  ) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
  centralReviewPost: (
    postId: string,
    status: string,
    comment?: string,
  ) => Promise<void>;
  appealPost: (
    postId: string,
    comment: string,
  ) => Promise<void>;
  reviewAppeal: (
    postId: string,
    approved: boolean,
    comment?: string,
  ) => Promise<void>;
  isLoading: boolean;
}

const PostsContext = createContext<
  PostsContextType | undefined
>(undefined);

const POSTS_CACHE_KEY = "smartech_audit_posts";

const readCachedPosts = (): AuditPost[] => {
  if (typeof window === "undefined") return [];

  try {
    const cached = window.localStorage.getItem(POSTS_CACHE_KEY);
    if (!cached) return [];

    const parsed = JSON.parse(cached);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const cachePosts = (posts: AuditPost[]) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      POSTS_CACHE_KEY,
      JSON.stringify(posts),
    );
  } catch {
    // Cache is only a resilience layer when the API is temporarily unavailable.
  }
};

export function PostsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [posts, setPosts] =
    useState<AuditPost[]>(readCachedPosts);

  const setPostsAndCache = (
    updater:
      | AuditPost[]
      | ((prevPosts: AuditPost[]) => AuditPost[]),
  ) => {
    setPosts((prevPosts) => {
      const nextPosts =
        typeof updater === "function"
          ? updater(prevPosts)
          : updater;
      cachePosts(nextPosts);
      return nextPosts;
    });
  };

  // Fetch posts from server on mount
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        setIsLoading(true);
        const response = await api.get("/posts");
        setPostsAndCache(
          Array.isArray(response.posts) ? response.posts : [],
        );
      } catch (error: any) {
        console.error("Failed to fetch posts:", error);
        setPostsAndCache((prevPosts) =>
          prevPosts.length > 0 ? prevPosts : readCachedPosts(),
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchPosts();
  }, []);

  const loadPostThumbnails = useCallback(async (
    postIds: string[],
  ): Promise<void> => {
    const ids = Array.from(new Set(postIds)).filter(Boolean);
    if (ids.length === 0) return;

    const postsMissingThumbnails = posts.some(
      (post) =>
        ids.includes(post.id) &&
        post.auditFocus === "pubmat" &&
        !post.thumbnail,
    );

    if (!postsMissingThumbnails) return;

    try {
      const response = await api.get(
        `/posts/thumbnails?ids=${encodeURIComponent(ids.join(","))}`,
      );
      const thumbnails = response.thumbnails || {};

      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          thumbnails[post.id]
            ? { ...post, thumbnail: thumbnails[post.id] }
            : post,
        ),
      );
    } catch (error) {
      console.error("Failed to fetch post thumbnails:", error);
    }
  }, [posts]);

  const addPost = async (post: AuditPost): Promise<void> => {
    try {
      await api.post("/posts", post);
    } catch (error) {
      // Server unavailable, continue with local storage
    }
    // Always update local state regardless of server response
    setPostsAndCache((prevPosts) => [post, ...prevPosts]);
  };

  const updatePost = async (
    postId: string,
    updatedPost: AuditPost,
  ): Promise<void> => {
    try {
      await api.put(`/posts/${postId}`, updatedPost);
    } catch (error) {
      // Server unavailable, continue with local storage
    }
    // Always update local state regardless of server response
    setPostsAndCache((prevPosts) =>
      prevPosts.map((post) =>
        post.id === postId ? updatedPost : post,
      ),
    );
  };

  const deletePost = async (postId: string): Promise<void> => {
    try {
      await api.delete(`/posts/${postId}`);
    } catch (error) {
      // Server unavailable, continue with local state.
    }

    setPostsAndCache((prevPosts) =>
      prevPosts.filter((post) => post.id !== postId),
    );
  };

  const centralReviewPost = async (
    postId: string,
    status: string,
    comment?: string,
  ): Promise<void> => {
    try {
      await api.post(`/posts/${postId}/central-review`, {
        centralReviewStatus: status,
        centralReviewComment: comment,
      });
    } catch (error) {
      // Server unavailable, continue with local storage
    }

    // Always update local state regardless of server response
    setPostsAndCache((prevPosts) =>
      prevPosts.map((post) =>
        post.id === postId
          ? {
              ...post,
              centralReviewStatus: status as any,
              centralReviewComment: comment,
              centralReviewDate: new Date()
                .toISOString()
                .split("T")[0],
            }
          : post,
      ),
    );
  };

  const appealPost = async (
    postId: string,
    comment: string,
  ): Promise<void> => {
    try {
      await api.post(`/posts/${postId}/appeal`, {
        appealComment: comment,
      });
    } catch (error) {
      console.error("Failed to appeal post:", error);
    }

    setPostsAndCache((prevPosts) =>
      prevPosts.map((post) =>
        post.id === postId
          ? {
              ...post,
              appealStatus: "Appealed",
              appealComment: comment,
              appealDate: new Date()
                .toISOString()
                .split("T")[0],
            }
          : post,
      ),
    );
  };

  const reviewAppeal = async (
    postId: string,
    approved: boolean,
    comment?: string,
  ): Promise<void> => {
    try {
      await api.post(`/posts/${postId}/review-appeal`, {
        approved,
        centralReviewComment: comment,
      });
    } catch (error) {
      // Server unavailable, continue with local storage
    }

    // Always update local state regardless of server response
    setPostsAndCache((prevPosts) =>
      prevPosts.map((post) =>
        post.id === postId
          ? {
              ...post,
              appealStatus: approved
                ? "Appeal Approved"
                : "Appeal Rejected",
              centralReviewStatus: approved
                ? "Good for Posting"
                : "For Revision",
              centralReviewComment: comment,
              centralReviewDate: new Date()
                .toISOString()
                .split("T")[0],
            }
          : post,
      ),
    );
  };

  return (
    <PostsContext.Provider
      value={{
        posts,
        loadPostThumbnails,
        addPost,
        updatePost,
        deletePost,
        centralReviewPost,
        appealPost,
        reviewAppeal,
        isLoading,
      }}
    >
      {children}
    </PostsContext.Provider>
  );
}

export function usePosts() {
  const context = useContext(PostsContext);
  if (context === undefined) {
    throw new Error(
      "usePosts must be used within a PostsProvider",
    );
  }
  return context;
}
