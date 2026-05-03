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
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePosts } from "@/contexts/PostsContext";
import { useState, useMemo } from "react";
import { getPostingDate } from "@/utils/postDates";

interface PubMatTableProps {
  posts: AuditPost[];
}

type SortColumn =
  | "id"
  | "pubmatType"
  | "platform"
  | "status"
  | "reviewStatus"
  | "appealStatus"
  | "date"
  | "actions";
type SortDirection = "asc" | "desc";

export function PubMatTable({ posts }: PubMatTableProps) {
  const { currentOffice } = useAuth();
  const { appealPost } = usePosts();
  const [appealingPostId, setAppealingPostId] = useState<
    string | null
  >(null);
  const [sortColumn, setSortColumn] =
    useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] =
    useState<SortDirection>("asc");
  const [selectedImage, setSelectedImage] = useState<
    string | null
  >(null);
  const [expandedReason, setExpandedReason] = useState<
    string | null
  >(null);
  const [expandedRemarks, setExpandedRemarks] = useState<
    string | null
  >(null);

  const isCentral = currentOffice === "Central NYC";

  const formatPlatforms = (platform: string | string[]) => {
    if (Array.isArray(platform)) {
      return platform.join(", ");
    }
    return platform;
  };

  const pubmatRemarkLabels =
    "logo order|logos|pubmat quality|watermark|template|sgd signature|checker response|correct logos present|correct logo order";

  const getRemarkLines = (remarks?: string) => {
    return (remarks || "")
      .replace(
        new RegExp(`\\s+(?=(${pubmatRemarkLabels}):)`, "gi"),
        "\n",
      )
      .split(/[;\n]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  };

  const formatRemarks = (remarks?: string) => {
    return getRemarkLines(remarks).join("\n");
  };

  const renderRemarks = (remarks?: string) => {
    const lines = getRemarkLines(remarks);

    if (lines.length === 0) return null;

    return lines.map((line, index) => {
      const separatorIndex = line.indexOf(":");
      const hasLabel = separatorIndex > -1;
      const label = hasLabel ? line.slice(0, separatorIndex + 1) : "";
      const detail = hasLabel ? line.slice(separatorIndex + 1).trimStart() : line;

      return (
        <div key={`${line}-${index}`}>
          {hasLabel ? (
            <>
              <span className="font-semibold text-foreground">
                {label}
              </span>{" "}
              <span>{detail}</span>
            </>
          ) : (
            <span>{detail}</span>
          )}
        </div>
      );
    });
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
        case "pubmatType":
          aValue = a.pubmatType || "";
          bValue = b.pubmatType || "";
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
      alert(
        "Appeal submitted successfully! Central office will review your appeal.",
      );
    } catch (error) {
      console.error("Error submitting appeal:", error);
      alert("Failed to submit appeal. Please try again.");
    } finally {
      setAppealingPostId(null);
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

  const getPubmatId = (postId: string) => {
    return postId.replace("POST-", "PUBMAT-");
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
      {/* Modals remain the same */}
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
              {renderRemarks(expandedRemarks)}
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
              {/* 1. Pubmat */}
              <TableHead>Pubmat</TableHead>

              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("pubmatType")}
              >
                PubMat Type
                <SortIcon column="pubmatType" />
              </TableHead>

              {/* 3. Status */}
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("status")}
              >
                Status
                <SortIcon column="status" />
              </TableHead>

              {/* 3. Remarks */}
              <TableHead>Remarks</TableHead>

              {!isCentral && (
                <>
                  {/* 4. Review Status */}
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("reviewStatus")}
                  >
                    Review Status
                    <SortIcon column="reviewStatus" />
                  </TableHead>

                  {/* 5. Appeal Status */}
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("appealStatus")}
                  >
                    Appeal Status
                    <SortIcon column="appealStatus" />
                  </TableHead>

                  {/* 6. Review Comment (Renamed) */}
                  <TableHead>Review Comment</TableHead>
                </>
              )}

              {/* 7. Posting Date (Renamed) */}
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("date")}
              >
                Posting Date
                <SortIcon column="date" />
              </TableHead>

              {/* 8. Platforms */}
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("platform")}
              >
                Platform/s
                <SortIcon column="platform" />
              </TableHead>

              {/* 9. Pubmat ID */}
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("id")}
              >
                Pubmat ID
                <SortIcon column="id" />
              </TableHead>

              {!isCentral && (
                <TableHead
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("actions")}
                >
                  Action
                  <SortIcon column="actions" />
                </TableHead>
              )}
            </TableRow>
          </TableHeader>

          <TableBody>
            {sortedPosts.map((post) => (
              <TableRow key={post.id}>
                {/* 1. Pubmat */}
                <TableCell>
                  <div className="flex items-start gap-3">
                    {post.thumbnail && (
                      <img
                        src={post.thumbnail}
                        alt={post.id}
                        className="h-20 w-20 rounded object-cover cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() =>
                          setSelectedImage(post.thumbnail!)
                        }
                      />
                    )}
                  </div>
                </TableCell>

                <TableCell className="text-sm font-medium">
                  {post.pubmatType || "-"}
                </TableCell>

                {/* 3. Status */}
                <TableCell>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusColor(
                      post.status,
                    )}`}
                  >
                    {post.status}
                  </span>
                </TableCell>

                {/* 3. Remarks */}
                <TableCell>
                  <div className="max-w-md text-sm text-muted-foreground">
                    <div className="line-clamp-3 space-y-1">
                      {renderRemarks(
                        post.remarks || post.recommendation,
                      )}
                    </div>
                    {(post.remarks || post.recommendation) &&
                      (post.remarks || post.recommendation)!
                        .length > 100 && (
                        <button
                          onClick={() =>
                            setExpandedRemarks(
                              formatRemarks(
                                post.remarks ||
                                  post.recommendation ||
                                  "",
                              ),
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
                    {/* 4. Review Status */}
                    <TableCell>
                      {getReviewStatusBadge(post)}
                    </TableCell>

                    {/* 5. Appeal Status */}
                    <TableCell>
                      {getAppealStatusBadge(post)}
                    </TableCell>

                    {/* 6. Review Comment */}
                    <TableCell>
                      {post.centralReviewComment ? (
                        <div className="max-w-md text-sm text-muted-foreground">
                          <div className="line-clamp-2">
                            {post.centralReviewComment}
                          </div>
                          {post.centralReviewComment.length >
                            100 && (
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

                {/* 7. Posting Date */}
                <TableCell className="text-sm">
                  {getPostingDate(post)}
                </TableCell>

                {/* 8. Platforms */}
                <TableCell>
                  {formatPlatforms(post.platform)}
                </TableCell>

                {/* 9. Pubmat ID */}
                <TableCell className="font-medium">
                  {getPubmatId(post.id)}
                </TableCell>

                {!isCentral && (
                  <TableCell>
                    {post.status === "Rejected" &&
                      (!post.appealStatus ||
                        post.appealStatus ===
                          "Not Appealed") && (
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
                    {post.appealStatus === "Appealed" && (
                      <span className="text-xs text-yellow-600">
                        Appeal Pending
                      </span>
                    )}
                    {post.appealStatus ===
                      "Appeal Approved" && (
                      <span className="text-xs text-green-600">
                        Appeal Approved
                      </span>
                    )}
                    {post.appealStatus ===
                      "Appeal Rejected" && (
                      <span className="text-xs text-red-600">
                        Appeal Rejected
                      </span>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
