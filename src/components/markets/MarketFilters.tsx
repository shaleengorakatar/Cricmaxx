import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { MarketType, MarketCategory } from "@/types/market";
import { Search, Filter, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/ui/card";

interface MarketFiltersProps {
  selectedCategory: MarketCategory | "All";
  selectedType: MarketType | "all";
  searchQuery: string;
  onCategoryChange: (category: MarketCategory | "All") => void;
  onTypeChange: (type: MarketType | "all") => void;
  onSearchChange: (query: string) => void;
}

const categories: (MarketCategory | "All")[] = [
  "All",
  "Cricket",
  "Politics",
  "Finance",
  "Technology",
  "Sports",
  "Entertainment",
];

const MarketFilters = ({
  selectedCategory,
  selectedType,
  searchQuery,
  onCategoryChange,
  onTypeChange,
  onSearchChange,
}: MarketFiltersProps) => {
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  
  // Count active filters (excluding "All" and "all")
  const activeFilterCount = 
    (selectedCategory !== "All" ? 1 : 0) + 
    (selectedType !== "all" ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Search Bar - Always visible */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search markets..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 h-12 text-base"
        />
      </div>

      {/* Mobile: Collapsible Filter Button */}
      <div className="md:hidden">
        <Button
          variant="outline"
          className="w-full h-12 justify-between"
          onClick={() => setFiltersExpanded(!filtersExpanded)}
        >
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="bg-accent text-accent-foreground rounded-full px-2 py-0.5 text-xs font-semibold">
                {activeFilterCount}
              </span>
            )}
          </div>
          {filtersExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Filter Controls - Collapsible on mobile, always visible on desktop */}
      <div className={`space-y-4 ${filtersExpanded ? 'block' : 'hidden'} md:block`}>
        <Card className="p-4 md:p-0 md:bg-transparent md:border-0 md:shadow-none">
          <div className="flex flex-col gap-4">
            {/* Category Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground md:hidden">
                Category
              </label>
              <Select value={selectedCategory} onValueChange={onCategoryChange}>
                <SelectTrigger className="w-full bg-card h-12 text-base">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="bg-card z-50">
                  {categories.map((category) => (
                    <SelectItem key={category} value={category} className="text-base py-3">
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Market Type Toggle */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground md:hidden">
                Market Type
              </label>
              <div className="grid grid-cols-3 gap-2 bg-muted p-1 rounded-lg">
                <Button
                  variant={selectedType === "all" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => onTypeChange("all")}
                  className={`h-10 text-sm ${selectedType === "all" ? "bg-primary text-primary-foreground" : ""}`}
                >
                  All
                </Button>
                <Button
                  variant={selectedType === "orderbook" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => onTypeChange("orderbook")}
                  className={`h-10 text-sm ${selectedType === "orderbook" ? "bg-primary text-primary-foreground" : ""}`}
                >
                  Order Book
                </Button>
                <Button
                  variant={selectedType === "amm" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => onTypeChange("amm")}
                  className={`h-10 text-sm ${selectedType === "amm" ? "bg-primary text-primary-foreground" : ""}`}
                >
                  AMM
                </Button>
              </div>
            </div>

            {/* Clear Filters - Mobile only */}
            {activeFilterCount > 0 && (
              <Button
                variant="outline"
                className="w-full md:hidden"
                onClick={() => {
                  onCategoryChange("All");
                  onTypeChange("all");
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default MarketFilters;
