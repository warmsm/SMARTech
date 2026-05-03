import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { Label } from "@/app/components/ui/label";
import { Button } from "@/app/components/ui/button";
import { X } from "lucide-react";

interface FiltersProps {
  status: string;
  platform: string;
  dateRange?: string;
  onStatusChange: (value: string) => void;
  onPlatformChange: (value: string) => void;
  onDateRangeChange?: (value: string) => void;
  onClearFilters?: () => void;
}

export function Filters({
  status,
  platform,
  dateRange,
  onStatusChange,
  onPlatformChange,
  onDateRangeChange,
  onClearFilters,
}: FiltersProps) {
  const hasActiveFilters =
    status !== "all" ||
    platform !== "all" ||
    (dateRange && dateRange !== "all");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="status-filter">Status</Label>
          <Select value={status} onValueChange={onStatusChange}>
            <SelectTrigger
              id="status-filter"
              className="w-[180px]"
            >
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Accepted">Accepted</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="platform-filter">Platform</Label>
          <Select
            value={platform}
            onValueChange={onPlatformChange}
          >
            <SelectTrigger
              id="platform-filter"
              className="w-[180px]"
            >
              <SelectValue placeholder="All Platforms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              <SelectItem value="Facebook">Facebook</SelectItem>
              <SelectItem value="Instagram">
                Instagram
              </SelectItem>
              <SelectItem value="X">X</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {onDateRangeChange && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="date-filter">Date</Label>
            <Select
              value={dateRange || "all"}
              onValueChange={onDateRangeChange}
            >
              <SelectTrigger
                id="date-filter"
                className="w-[180px]"
              >
                <SelectValue placeholder="All Time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="last7days">
                  Last 7 Days
                </SelectItem>
                <SelectItem value="last30days">
                  Last 30 Days
                </SelectItem>
                <SelectItem value="thisMonth">
                  This Month
                </SelectItem>
                <SelectItem value="lastMonth">
                  Last Month
                </SelectItem>
                <SelectItem value="last3months">
                  Last 3 Months
                </SelectItem>
                <SelectItem value="last6months">
                  Last 6 Months
                </SelectItem>
                <SelectItem value="upcoming">
                  Upcoming
                </SelectItem>
                <SelectItem value="next7days">
                  Next 7 Days
                </SelectItem>
                <SelectItem value="next30days">
                  Next 30 Days
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {hasActiveFilters && onClearFilters && (
          <Button
            variant="outline"
            onClick={onClearFilters}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Clear Filters
          </Button>
        )}
      </div>
    </div>
  );
}
