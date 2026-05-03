import { useMemo, useState } from "react";
import { PubMatTable } from "@/app/components/PubMatTable";
import { CaptionTable } from "@/app/components/CaptionTable";
import { Filters } from "@/app/components/Filters";
import { usePosts } from "@/contexts/PostsContext";
import { useAuth } from "@/contexts/AuthContext";
import { getPostingDate } from "@/utils/postDates";

export function HomePage() {
  const { posts, isLoading } = usePosts();
  const { currentOffice } = useAuth();

  const [pubmatStatusFilter, setPubmatStatusFilter] =
    useState("all");
  const [pubmatPlatformFilter, setPubmatPlatformFilter] =
    useState("all");
  const [pubmatDateRangeFilter, setPubmatDateRangeFilter] =
    useState("all");

  const [captionStatusFilter, setCaptionStatusFilter] =
    useState("all");
  const [captionPlatformFilter, setCaptionPlatformFilter] =
    useState("all");
  const [captionDateRangeFilter, setCaptionDateRangeFilter] =
    useState("all");

  const officePosts = useMemo(() => {
    if (!currentOffice) return [];

    return currentOffice === "Central NYC"
      ? posts
      : posts.filter((post) => post.office === currentOffice);
  }, [posts, currentOffice]);

  const matchesDateFilter = (
    postDateValue: string,
    dateRangeFilter: string,
  ) => {
    if (dateRangeFilter === "all") return true;

    const [year, month, day] = postDateValue
      .split("-")
      .map(Number);
    const postDate =
      year && month && day
        ? new Date(year, month - 1, day)
        : new Date(postDateValue);

    if (Number.isNaN(postDate.getTime())) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    switch (dateRangeFilter) {
      case "today":
        return postDate >= today && postDate < tomorrow;

      case "last7days": {
        const last7Days = new Date(today);
        last7Days.setDate(today.getDate() - 7);
        return postDate >= last7Days && postDate < tomorrow;
      }

      case "last30days": {
        const last30Days = new Date(today);
        last30Days.setDate(today.getDate() - 30);
        return postDate >= last30Days && postDate < tomorrow;
      }

      case "thisMonth":
        return (
          postDate.getMonth() === today.getMonth() &&
          postDate.getFullYear() === today.getFullYear()
        );

      case "lastMonth": {
        const lastMonth = new Date(today);
        lastMonth.setMonth(today.getMonth() - 1);
        return (
          postDate.getMonth() === lastMonth.getMonth() &&
          postDate.getFullYear() === lastMonth.getFullYear()
        );
      }

      case "last3months": {
        const last3Months = new Date(today);
        last3Months.setMonth(today.getMonth() - 3);
        return postDate >= last3Months && postDate < tomorrow;
      }

      case "last6months": {
        const last6Months = new Date(today);
        last6Months.setMonth(today.getMonth() - 6);
        return postDate >= last6Months && postDate < tomorrow;
      }

      case "upcoming":
        return postDate >= tomorrow;

      case "next7days": {
        const next7Days = new Date(today);
        next7Days.setDate(today.getDate() + 7);
        return postDate >= tomorrow && postDate <= next7Days;
      }

      case "next30days": {
        const next30Days = new Date(today);
        next30Days.setDate(today.getDate() + 30);
        return postDate >= tomorrow && postDate <= next30Days;
      }

      default:
        return true;
    }
  };

  const filteredPubMats = useMemo(() => {
    return officePosts.filter((post) => {
      const matchesAuditFocus = post.auditFocus === "pubmat";

      const matchesStatus =
        pubmatStatusFilter === "all" ||
        post.status === pubmatStatusFilter;

      const matchesPlatform =
        pubmatPlatformFilter === "all" ||
        (Array.isArray(post.platform)
          ? post.platform.includes(pubmatPlatformFilter as any)
          : post.platform === pubmatPlatformFilter);

      const matchesDate = matchesDateFilter(
        getPostingDate(post),
        pubmatDateRangeFilter,
      );

      return (
        matchesAuditFocus &&
        matchesStatus &&
        matchesPlatform &&
        matchesDate
      );
    });
  }, [
    officePosts,
    pubmatStatusFilter,
    pubmatPlatformFilter,
    pubmatDateRangeFilter,
  ]);

  const filteredCaptions = useMemo(() => {
    return officePosts.filter((post) => {
      const matchesAuditFocus = post.auditFocus === "caption";

      const matchesStatus =
        captionStatusFilter === "all" ||
        post.status === captionStatusFilter;

      const matchesPlatform =
        captionPlatformFilter === "all" ||
        (Array.isArray(post.platform)
          ? post.platform.includes(captionPlatformFilter as any)
          : post.platform === captionPlatformFilter);

      const matchesDate = matchesDateFilter(
        getPostingDate(post),
        captionDateRangeFilter,
      );

      return (
        matchesAuditFocus &&
        matchesStatus &&
        matchesPlatform &&
        matchesDate
      );
    });
  }, [
    officePosts,
    captionStatusFilter,
    captionPlatformFilter,
    captionDateRangeFilter,
  ]);

  const clearPubMatFilters = () => {
    setPubmatStatusFilter("all");
    setPubmatPlatformFilter("all");
    setPubmatDateRangeFilter("all");
  };

  const clearCaptionFilters = () => {
    setCaptionStatusFilter("all");
    setCaptionPlatformFilter("all");
    setCaptionDateRangeFilter("all");
  };

  return (
    <div className="space-y-10">
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">
            Loading posts...
          </p>
        </div>
      ) : (
        <>
          <section className="space-y-4">
            <h2 className="text-2xl font-bold">PubMats</h2>

            <Filters
              status={pubmatStatusFilter}
              platform={pubmatPlatformFilter}
              dateRange={pubmatDateRangeFilter}
              onStatusChange={setPubmatStatusFilter}
              onPlatformChange={setPubmatPlatformFilter}
              onDateRangeChange={setPubmatDateRangeFilter}
              onClearFilters={clearPubMatFilters}
            />

            <PubMatTable posts={filteredPubMats} />
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">Captions</h2>

            <Filters
              status={captionStatusFilter}
              platform={captionPlatformFilter}
              dateRange={captionDateRangeFilter}
              onStatusChange={setCaptionStatusFilter}
              onPlatformChange={setCaptionPlatformFilter}
              onDateRangeChange={setCaptionDateRangeFilter}
              onClearFilters={clearCaptionFilters}
            />

            <CaptionTable posts={filteredCaptions} />
          </section>
        </>
      )}
    </div>
  );
}
