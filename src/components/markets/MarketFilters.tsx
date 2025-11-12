import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { MarketType, MarketCategory } from "@/types/market";
import { Search } from "lucide-react";

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
  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search markets..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        {/* Category Filter */}
        <div className="flex-1">
          <Select value={selectedCategory} onValueChange={onCategoryChange}>
            <SelectTrigger className="w-full bg-card">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent className="bg-card z-50">
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Market Type Toggle */}
        <div className="flex gap-2 bg-muted p-1 rounded-lg">
          <Button
            variant={selectedType === "all" ? "default" : "ghost"}
            size="sm"
            onClick={() => onTypeChange("all")}
            className={selectedType === "all" ? "bg-primary text-primary-foreground" : ""}
          >
            All Markets
          </Button>
          <Button
            variant={selectedType === "orderbook" ? "default" : "ghost"}
            size="sm"
            onClick={() => onTypeChange("orderbook")}
            className={selectedType === "orderbook" ? "bg-primary text-primary-foreground" : ""}
          >
            Order Book
          </Button>
          <Button
            variant={selectedType === "amm" ? "default" : "ghost"}
            size="sm"
            onClick={() => onTypeChange("amm")}
            className={selectedType === "amm" ? "bg-primary text-primary-foreground" : ""}
          >
            AMM
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MarketFilters;
