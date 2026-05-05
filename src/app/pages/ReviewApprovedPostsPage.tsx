import { useMemo, useState } from "react";
import { usePosts } from "@/contexts/PostsContext";
import { useAuth } from "@/contexts/AuthContext";
import { Check, X } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { Label } from "@/app/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";
import { AuditPost } from "@/data/mockData";
import { getPostingDate } from "@/utils/postDates";

export default function ReviewApprovedPostsPage() {
  const { posts, centralReviewPost } = usePosts();
  const { currentOffice } = useAuth();
  const [reviewingPostId, setReviewingPostId] = useState<
    string | null
  >(null);
  const [comment, setComment] = useState("");
  const [selectedImage, setSelectedImage] = useState<
    string | null
  >(null);
  const [expandedCaption, setExpandedCaption] = useState<
    string | null
  >(null);
  const [dateFilter, setDateFilter] = useState("all");

  const isCentral = currentOffice === "Central NYC";

  const getPostTime = (post: AuditPost) =>
    new Date(getPostingDate(post)).getTime();

  const getStartOfToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  };

  const parsePostingDate = (post: AuditPost) => {
    const value = getPostingDate(post);
    const [year, month, day] = value.split("-").map(Number);
    const parsed =
      year && month && day
        ? new Date(year, month - 1, day)
        : new Date(value);

    if (Number.isNaN(parsed.getTime())) return null;
    parsed.setHours(0, 0, 0, 0);
    return parsed;
  };

  const isWithinDateFilter = (post: AuditPost) => {
    if (dateFilter === "all") return true;

    const postDate = parsePostingDate(post);
    if (!postDate) return false;

    const today = getStartOfToday();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    switch (dateFilter) {
      case "postedLastMonth": {
        const lastMonth = new Date(today);
        lastMonth.setMonth(today.getMonth() - 1);
        return (
          postDate.getMonth() === lastMonth.getMonth() &&
          postDate.getFullYear() === lastMonth.getFullYear()
        );
      }

      case "postedLast7Days": {
        const start = new Date(today);
        start.setDate(today.getDate() - 7);
        return postDate >= start && postDate < tomorrow;
      }

      case "postedLast3Days": {
        const start = new Date(today);
        start.setDate(today.getDate() - 3);
        return postDate >= start && postDate < tomorrow;
      }

      case "today":
        return postDate.getTime() === today.getTime();

      case "next3Days": {
        const end = new Date(today);
        end.setDate(today.getDate() + 3);
        return postDate >= tomorrow && postDate <= end;
      }

      case "next7Days": {
        const end = new Date(today);
        end.setDate(today.getDate() + 7);
        return postDate >= tomorrow && postDate <= end;
      }

      case "nextMonth": {
        const nextMonth = new Date(today);
        nextMonth.setMonth(today.getMonth() + 1);
        return (
          postDate.getMonth() === nextMonth.getMonth() &&
          postDate.getFullYear() === nextMonth.getFullYear()
        );
      }

      default:
        return true;
    }
  };

  const approvedPosts = useMemo(() => {
    const today = getStartOfToday().getTime();

    return posts
      .filter((post) => post.status === "Accepted")
      .sort((a, b) => {
        const aTime = getPostTime(a);
        const bTime = getPostTime(b);

        const aIsPast = aTime < today;
        const bIsPast = bTime < today;

        if (aIsPast !== bIsPast) {
          return aIsPast ? 1 : -1;
        }

        return aTime - bTime;
      });
  }, [posts]);

  const filteredApprovedPosts = useMemo(() => {
    return approvedPosts.filter(isWithinDateFilter);
  }, [approvedPosts, dateFilter]);

  if (!isCentral) {
    return (
      <div className="text-center text-muted-foreground py-10">
        You do not have access to this page. Only Central NYC
        can review approved posts.
      </div>
    );
  }

  const handleApprove = async (postId: string) => {
    try {
      await centralReviewPost(postId, "Good for Posting");
      alert("Post approved as Good for Posting!");
    } catch (error) {
      console.error("Error approving post:", error);
      alert("Failed to approve post. Please try again.");
    }
  };

  const handleReject = async (postId: string) => {
    const rejectionComment = prompt(
      "Please provide a reason for revision:",
    );
    if (!rejectionComment) return;

    try {
      await centralReviewPost(
        postId,
        "For Revision",
        rejectionComment,
      );
      alert("Post marked for revision!");
    } catch (error) {
      console.error("Error rejecting post:", error);
      alert(
        "Failed to mark post for revision. Please try again.",
      );
    }
  };

  const formatPlatforms = (platform: string | string[]) => {
    if (Array.isArray(platform)) {
      return platform.join(", ");
    }
    return platform;
  };

  const getReviewStatusBadge = (post: AuditPost) => {
    // If status is null, undefined, or explicitly "Pending Review"
    if (
      !post.centralReviewStatus ||
      post.centralReviewStatus === "Pending Review"
    ) {
      return (
        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-yellow-100 text-yellow-800">
          Pending
        </span>
      );
    }

    // If explicitly marked as good
    if (post.centralReviewStatus === "Good for Posting") {
      return (
        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-green-100 text-green-800">
          Good for Posting
        </span>
      );
    }

    // If status is "For Revision"
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-red-100 text-red-800">
        For Revision
      </span>
    );
  };

  return (
    <>
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={selectedImage}
              alt="Enlarged pubmat"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-2 right-2 bg-white/90 hover:bg-white text-black rounded-full p-2 w-8 h-8 flex items-center justify-center font-bold"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {expandedCaption && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setExpandedCaption(null)}
        >
          <div className="relative max-w-2xl w-full bg-white rounded-lg p-6">
            <h3 className="text-lg font-bold mb-4">
              Full Caption
            </h3>
            <p className="text-sm whitespace-pre-wrap">
              {expandedCaption}
            </p>
            <button
              onClick={() => setExpandedCaption(null)}
              className="absolute top-2 right-2 bg-gray-200 hover:bg-gray-300 text-black rounded-full p-2 w-8 h-8 flex items-center justify-center font-bold"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Review Approved Posts
          </h1>
          <p className="text-muted-foreground">
            Cross-check approved posts from all offices
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="review-date-filter">Date</Label>
            <Select
              value={dateFilter}
              onValueChange={setDateFilter}
            >
              <SelectTrigger
                id="review-date-filter"
                className="w-[220px]"
              >
                <SelectValue placeholder="All Time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="postedLastMonth">
                  Posted Last Month
                </SelectItem>
                <SelectItem value="postedLast7Days">
                  Posted Last 7 Days
                </SelectItem>
                <SelectItem value="postedLast3Days">
                  Posted Last 3 Days
                </SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="next3Days">
                  To Be Posted within 3 days
                </SelectItem>
                <SelectItem value="next7Days">
                  To Be Posted within 7 days
                </SelectItem>
                <SelectItem value="nextMonth">
                  To Be Posted within a month
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {dateFilter !== "all" && (
            <Button
              variant="outline"
              onClick={() => setDateFilter("all")}
            >
              Clear Filter
            </Button>
          )}
        </div>

        {filteredApprovedPosts.length === 0 ? (
          <div className="text-center text-muted-foreground py-10 bg-card rounded-lg border">
            No approved posts to review
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Office</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Posting Date</TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Review Status</TableHead>
                  <TableHead>Comment</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredApprovedPosts.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell className="font-medium">
                      {post.id}
                    </TableCell>
                    <TableCell className="text-sm">
                      {post.office}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatPlatforms(post.platform)}
                    </TableCell>
                    <TableCell className="text-sm capitalize">
                      {post.auditFocus}
                    </TableCell>
                    <TableCell className="text-sm">
                      {getPostingDate(post)}
                    </TableCell>

                    <TableCell>
                      <div className="max-w-md">
                        {post.thumbnail && (
                          <img
                            src={post.thumbnail}
                            alt={post.id}
                            className="h-16 w-16 rounded object-cover mb-2 cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() =>
                              setSelectedImage(post.thumbnail!)
                            }
                          />
                        )}
                        {post.caption && (
                          <div className="text-sm text-muted-foreground">
                            <div className="line-clamp-2">
                              {post.caption}
                            </div>
                            {post.caption.length > 150 && (
                              <button
                                onClick={() =>
                                  setExpandedCaption(
                                    post.caption || "",
                                  )
                                }
                                className="text-primary hover:underline text-xs mt-1"
                              >
                                See more
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-green-100 text-green-800">
                        {post.status}
                      </span>
                    </TableCell>

                    <TableCell>
                      {getReviewStatusBadge(post)}
                    </TableCell>

                    <TableCell>
                      {post.centralReviewComment && (
                        <p className="text-sm text-muted-foreground max-w-xs">
                          {post.centralReviewComment}
                        </p>
                      )}
                    </TableCell>

                    <TableCell>
                      {!post.centralReviewStatus ||
                      post.centralReviewStatus ===
                        "Pending Review" ? (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleApprove(post.id)
                            }
                            className="border-green-500 text-green-700 hover:bg-green-50"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleReject(post.id)
                            }
                            className="border-red-500 text-red-700 hover:bg-red-50"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Reviewed
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </>
  );
}
