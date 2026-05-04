import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { AuditPost } from "@/data/mockData";
import { api } from "@/utils/supabase/client";

interface PostsContextType {
  posts: AuditPost[];
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

export function PostsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [posts, setPosts] = useState<AuditPost[]>([]);

  // Fetch posts from server on mount
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        setIsLoading(true);
        const response = await api.get("/posts");
        setPosts(response.posts || []);
      } catch (error: any) {
          console.error("❌ REAL ERROR:", error);
          setPosts([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPosts();
  }, []);

  const addPost = async (post: AuditPost): Promise<void> => {
    try {
      await api.post("/posts", post);
    } catch (error) {
      // Server unavailable, continue with local storage
    }
    // Always update local state regardless of server response
    setPosts((prevPosts) => [post, ...prevPosts]);
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
    setPosts((prevPosts) =>
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

    setPosts((prevPosts) =>
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
    setPosts((prevPosts) =>
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

    setPosts((prevPosts) =>
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
    setPosts((prevPosts) =>
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
