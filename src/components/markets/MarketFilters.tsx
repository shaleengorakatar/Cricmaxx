import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { MarketCategory } from "@/types/market";
import { Search, X } from "lucide-react";

interface MarketFiltersProps {
  selectedCategory: MarketCategory | "All";
  searchQuery: string;
  onCategoryChange: (category: MarketCategory | "All") => void;
  onSearchChange: (query: string) => void;
}

const categories: (MarketCategory | "All")[] = [
  "All", "Cricket", "Politics", "Finance", "Technology", "Sports", "Entertainment",
];

const MarketFilters = ({
  selectedCategory,
  searchQuery,
  onCategoryChange,
  onSearchChange,
}: MarketFiltersProps) => {
  return (
    <div className="flex items-center gap-2">
      {/* Search */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search markets..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Category */}
      <Select value={selectedCategory} onValueChange={onCategoryChange}>
        <SelectTrigger className="h-9 w-36 text-sm shrink-0">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent className="bg-card z-50">
          {categories.map((category) => (
            <SelectItem key={category} value={category} className="text-sm">
              {category}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default MarketFilters;
