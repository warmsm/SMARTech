import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";
import { AuditPost } from "@/data/mockData";
import { Button } from "@/app/components/ui/button";
import {
  MessageSquare,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePosts } from "@/contexts/PostsContext";
import { useState, useMemo } from "react";
import { getPostingDate } from "@/utils/postDates";
import { getCaptionRemarkRows } from "@/utils/captionRemarks";

interface CaptionTableProps {
  posts: AuditPost[];
}

type SortColumn =
  | "id"
  | "platform"
  | "status"
  | "reviewStatus"
  | "appealStatus"
  | "date"
  | "actions";
type SortDirection = "asc" | "desc";

export function CaptionTable({ posts }: CaptionTableProps) {
  const { currentOffice } = useAuth();
  const { appealPost, deletePost } = usePosts();
  const [appealingPostId, setAppealingPostId] = useState<
    string | null
  >(null);
  const [deletingPostId, setDeletingPostId] = useState<
    string | null
  >(null);
  const [sortColumn, setSortColumn] =
    useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] =
    useState<SortDirection>("asc");
  const [expandedCaption, setExpandedCaption] = useState<
    string | null
  >(null);
  const [expandedReason, setExpandedReason] = useState<
    string | null
  >(null);
  const [expandedRemarks, setExpandedRemarks] = useState<{
    remarks: string;
    caption?: string;
    platform?: string | string[];
  } | null>(null);

  const isCentral = currentOffice === "Central NYC";

  const formatPlatforms = (platform: string | string[]) => {
    if (Array.isArray(platform)) {
      return platform.join(", ");
    }
    return platform;
  };

  const renderRemarks = (
    remarks?: string,
    caption?: string,
    platform?: string | string[],
    variant: "table" | "lines" = "table",
  ) => {
    const rows = getCaptionRemarkRows({ remarks, caption, platform });

    if (rows.length === 0) return null;

    if (variant === "lines") {
      return rows.map((row, index) => (
        <div
          key={`${row.label}-${index}`}
          className="leading-snug"
        >
          <span
            className={
              row.emphasizeLabel === false
                ? "text-foreground"
                : "font-semibold text-foreground"
            }
          >
            {row.label}
          </span>
          {row.detail ? (
            <span className="whitespace-pre-line">
              : {row.detail}
            </span>
          ) : null}
        </div>
      ));
    }

    return (
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="w-1/3 px-3 py-2 text-left font-semibold text-foreground">
                Criteria
              </th>
              <th className="px-3 py-2 text-left font-semibold text-foreground">
                Remark
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row, index) => (
              <tr key={`${row.label}-${index}`}>
                <td
                  className={`px-3 py-2 align-top text-foreground ${
                    row.emphasizeLabel === false
                      ? "font-normal"
                      : "font-semibold"
                  }`}
                >
                  {row.label}
                </td>
                <td className="whitespace-pre-line px-3 py-2 align-top text-muted-foreground">
                  {row.detail}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(
        sortDirection === "asc" ? "desc" : "asc",
      );
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const sortedPosts = useMemo(() => {
    if (!sortColumn) return posts;

    return [...posts].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortColumn) {
        case "id":
          aValue = a.id;
          bValue = b.id;
          break;
        case "platform":
          aValue = formatPlatforms(a.platform);
          bValue = formatPlatforms(b.platform);
          break;
        case "status":
          aValue = a.status;
          bValue = b.status;
          break;
        case "reviewStatus":
          aValue = a.centralReviewStatus || "Pending Review";
          bValue = b.centralReviewStatus || "Pending Review";
          break;
        case "appealStatus":
          aValue = a.appealStatus || "Not Appealed";
          bValue = b.appealStatus || "Not Appealed";
          break;
        case "date":
          aValue = new Date(getPostingDate(a));
          bValue = new Date(getPostingDate(b));
          break;
        case "actions":
          aValue =
            a.status === "Rejected" &&
            (!a.appealStatus ||
              a.appealStatus === "Not Appealed")
              ? 1
              : 0;
          bValue =
            b.status === "Rejected" &&
            (!b.appealStatus ||
              b.appealStatus === "Not Appealed")
              ? 1
              : 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue)
        return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue)
        return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [posts, sortColumn, sortDirection]);

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-4 w-4 ml-1 inline" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="h-4 w-4 ml-1 inline" />
    ) : (
      <ArrowDown className="h-4 w-4 ml-1 inline" />
    );
  };

  const handleAppeal = async (postId: string) => {
    const reason = prompt(
      "Please provide a reason for appealing this rejection:",
    );
    if (!reason) return;

    try {
      setAppealingPostId(postId);
      await appealPost(postId, reason);
      alert("Appeal submitted successfully!");
    } catch (error) {
      console.error("Error submitting appeal:", error);
      alert("Failed to submit appeal.");
    } finally {
      setAppealingPostId(null);
    }
  };

  const handleDelete = async (postId: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this Caption entry? This action cannot be undone.",
    );
    if (!confirmed) return;

    try {
      setDeletingPostId(postId);
      await deletePost(postId);
    } catch (error) {
      console.error("Error deleting Caption:", error);
      alert("Failed to delete entry. Please try again.");
    } finally {
      setDeletingPostId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Accepted":
        return "bg-primary text-primary-foreground";
      case "Rejected":
        return "bg-secondary text-secondary-foreground";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return "text-primary";
    return "text-secondary";
  };

  const getCaptionId = (postId: string) => {
    return postId.replace("POST-", "CAPTION-");
  };

  const getReviewStatusBadge = (post: AuditPost) => {
    const isSystemRejected = post.status === "Rejected";
    const hasNotAppealed =
      !post.appealStatus ||
      post.appealStatus === "Not Appealed";

    if (isSystemRejected && hasNotAppealed) {
      return <span className="text-xs text-gray-500">-</span>;
    }

    if (
      !post.centralReviewStatus ||
      post.centralReviewStatus === "Pending Review"
    ) {
      return (
        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-yellow-100 text-yellow-800">
          Pending Review
        </span>
      );
    }

    if (post.centralReviewStatus === "Good for Posting") {
      return (
        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-green-100 text-green-800">
          Good for Posting
        </span>
      );
    }

    const label =
      post.appealStatus === "Appeal Rejected"
        ? "Rejected"
        : "For Revision";
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-red-100 text-red-800">
        {label}
      </span>
    );
  };

  const getAppealStatusBadge = (post: AuditPost) => {
    if (
      !post.appealStatus ||
      post.appealStatus === "Not Appealed"
    ) {
      return <span className="text-xs text-gray-500">-</span>;
    }
    if (post.appealStatus === "Appealed") {
      return (
        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-yellow-100 text-yellow-800">
          Appeal Pending
        </span>
      );
    }
    if (post.appealStatus === "Appeal Approved") {
      return (
        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-green-100 text-green-800">
          Appeal Approved
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-red-100 text-red-800">
        Appeal Rejected
      </span>
    );
  };

  return (
    <>
      {/* Modals for expanding text (ExpandedCaption, ExpandedReason, ExpandedRemarks) remain here... */}
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
      {expandedReason && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setExpandedReason(null)}
        >
          <div className="relative max-w-2xl w-full bg-white rounded-lg p-6">
            <h3 className="text-lg font-bold mb-4">
              Review Comment
            </h3>
            <p className="text-sm whitespace-pre-wrap">
              {expandedReason}
            </p>
            <button
              onClick={() => setExpandedReason(null)}
              className="absolute top-2 right-2 bg-gray-200 hover:bg-gray-300 text-black rounded-full p-2 w-8 h-8 flex items-center justify-center font-bold"
            >
              ×
            </button>
          </div>
        </div>
      )}
      {expandedRemarks && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setExpandedRemarks(null)}
        >
          <div className="relative max-w-2xl w-full bg-white rounded-lg p-6">
            <h3 className="text-lg font-bold mb-4">
              Full Remarks
            </h3>
            <div className="space-y-2 text-sm">
              {renderRemarks(
                expandedRemarks.remarks,
                expandedRemarks.caption,
                expandedRemarks.platform,
              )}
            </div>
            <button
              onClick={() => setExpandedRemarks(null)}
              className="absolute top-2 right-2 bg-gray-200 hover:bg-gray-300 text-black rounded-full p-2 w-8 h-8 flex items-center justify-center font-bold"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {/* 1. Caption */}
              <TableHead>Caption</TableHead>

              {/* 2. Status */}
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("status")}
              >
                Status <SortIcon column="status" />
              </TableHead>

              {/* 3-6. AI Scores */}
              <TableHead>Score</TableHead>
              <TableHead>Grammar</TableHead>
              <TableHead>Inclusivity</TableHead>
              <TableHead>Tone</TableHead>

              {/* 7. Remarks */}
              <TableHead>Remarks</TableHead>

              {!isCentral && (
                <>
                  {/* 8. Review Status */}
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("reviewStatus")}
                  >
                    Review Status{" "}
                    <SortIcon column="reviewStatus" />
                  </TableHead>

                  {/* 9. Appeal Status */}
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("appealStatus")}
                  >
                    Appeal Status{" "}
                    <SortIcon column="appealStatus" />
                  </TableHead>

                  {/* 10. Review Comment (Renamed) */}
                  <TableHead>Review Comment</TableHead>
                </>
              )}

              {/* 11. Posting Date (Renamed) */}
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("date")}
              >
                Posting Date <SortIcon column="date" />
              </TableHead>

              {/* 12. Platforms (Renamed) */}
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("platform")}
              >
                Platform/s <SortIcon column="platform" />
              </TableHead>

              {/* 13. Caption ID */}
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("id")}
              >
                Caption ID <SortIcon column="id" />
              </TableHead>

              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("actions")}
              >
                Actions <SortIcon column="actions" />
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {sortedPosts.map((post) => (
              <TableRow key={post.id}>
                {/* 1. Caption */}
                <TableCell>
                  <div className="max-w-md text-sm text-muted-foreground">
                    <div className="line-clamp-3">
                      {post.caption}
                    </div>
                    {post.caption &&
                      post.caption.length > 50 && (
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
                </TableCell>

                {/* 2. Status */}
                <TableCell>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusColor(post.status)}`}
                  >
                    {post.status}
                  </span>
                </TableCell>

                {/* 3-6. AI Scores */}
                <TableCell>
                  <span
                    className={`font-semibold ${getScoreColor(post.score)}`}
                  >
                    {post.score}
                  </span>
                </TableCell>
                <TableCell>{post.grammar ?? "-"}</TableCell>
                <TableCell>{post.inclusivity ?? "-"}</TableCell>
                <TableCell>{post.tone ?? "-"}</TableCell>

                {/* 7. Remarks */}
                <TableCell>
                  <div className="max-w-md text-sm text-muted-foreground">
                    <div className="line-clamp-2 space-y-1">
                      {renderRemarks(
                        post.remarks || post.recommendation,
                        post.caption,
                        post.platform,
                        "lines",
                      )}
                    </div>
                    {(post.remarks || post.recommendation) &&
                      (post.remarks || post.recommendation)!
                        .length > 50 && (
                        <button
                          onClick={() =>
                            setExpandedRemarks(
                              {
                                remarks:
                                  post.remarks ||
                                  post.recommendation ||
                                  "",
                                caption: post.caption,
                                platform: post.platform,
                              },
                            )
                          }
                          className="text-primary hover:underline text-xs mt-1"
                        >
                          See more
                        </button>
                      )}
                  </div>
                </TableCell>

                {!isCentral && (
                  <>
                    {/* 8. Review Status */}
                    <TableCell>
                      {getReviewStatusBadge(post)}
                    </TableCell>

                    {/* 9. Appeal Status */}
                    <TableCell>
                      {getAppealStatusBadge(post)}
                    </TableCell>

                    {/* 10. Review Comment */}
                    <TableCell>
                      {post.centralReviewComment ? (
                        <div className="max-w-md text-sm text-muted-foreground">
                          <div className="line-clamp-2">
                            {post.centralReviewComment}
                          </div>
                          {post.centralReviewComment.length >
                            50 && (
                            <button
                              onClick={() =>
                                setExpandedReason(
                                  post.centralReviewComment ||
                                    "",
                                )
                              }
                              className="text-primary hover:underline text-xs mt-1"
                            >
                              See more
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">
                          -
                        </span>
                      )}
                    </TableCell>
                  </>
                )}

                {/* 11. Posting Date */}
                <TableCell className="text-sm">
                  {getPostingDate(post)}
                </TableCell>

                {/* 12. Platform/s */}
                <TableCell>
                  {formatPlatforms(post.platform)}
                </TableCell>

                {/* 13. Pubmat ID */}
                <TableCell className="font-medium">
                  {getCaptionId(post.id)}
                </TableCell>

                <TableCell>
                  <div className="flex flex-wrap items-center gap-2">
                    {!isCentral &&
                      post.status === "Rejected" &&
                      (!post.appealStatus ||
                        post.appealStatus === "Not Appealed") && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAppeal(post.id)}
                            disabled={appealingPostId === post.id}
                            className="text-xs"
                          >
                            <MessageSquare className="h-3 w-3 mr-1" />
                            {appealingPostId === post.id
                              ? "Submitting..."
                              : "Appeal"}
                          </Button>
                        )}
                    {!isCentral &&
                      post.appealStatus === "Appealed" && (
                        <span className="text-xs text-yellow-600">
                          Appeal Pending
                        </span>
                      )}
                    {!isCentral &&
                      post.appealStatus === "Appeal Approved" && (
                        <span className="text-xs text-green-600">
                          Appeal Approved
                        </span>
                      )}
                    {!isCentral &&
                      post.appealStatus === "Appeal Rejected" && (
                        <span className="text-xs text-red-600">
                          Appeal Rejected
                        </span>
                      )}
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(post.id)}
                      disabled={deletingPostId === post.id}
                      className="text-xs"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      {deletingPostId === post.id
                        ? "Deleting..."
                        : "Delete"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
