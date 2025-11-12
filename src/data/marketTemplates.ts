import { MarketTemplateConfig } from "@/types/creator";

export const marketTemplates: MarketTemplateConfig[] = [
  {
    id: "cricket_player_performance",
    name: "Cricket: Player Performance",
    category: "Cricket",
    fields: [
      {
        name: "playerName",
        label: "Player Name",
        type: "select",
        options: ["Virat Kohli", "Rohit Sharma", "KL Rahul", "Jasprit Bumrah", "Ravindra Jadeja"],
        placeholder: "Select player",
        required: true,
      },
      {
        name: "statistic",
        label: "Statistic",
        type: "select",
        options: ["runs", "wickets", "catches"],
        placeholder: "Select statistic",
        required: true,
      },
      {
        name: "threshold",
        label: "Performance Threshold",
        type: "number",
        placeholder: "e.g., 50 for runs",
        required: true,
      },
      {
        name: "matchDate",
        label: "Match Date",
        type: "date",
        required: true,
      },
    ],
    questionPattern: "Will {playerName} score {threshold}+ {statistic} on {matchDate}?",
  },
  {
    id: "cricket_match_result",
    name: "Cricket: Match Result",
    category: "Cricket",
    fields: [
      {
        name: "teamA",
        label: "Team A",
        type: "text",
        placeholder: "e.g., India",
        required: true,
      },
      {
        name: "teamB",
        label: "Team B",
        type: "text",
        placeholder: "e.g., Australia",
        required: true,
      },
      {
        name: "matchDate",
        label: "Match Date",
        type: "date",
        required: true,
      },
    ],
    questionPattern: "Will {teamA} defeat {teamB} on {matchDate}?",
  },
  {
    id: "politics_election",
    name: "Politics: Election Outcome",
    category: "Politics",
    fields: [
      {
        name: "candidate",
        label: "Candidate/Party",
        type: "text",
        placeholder: "e.g., Democrats",
        required: true,
      },
      {
        name: "position",
        label: "Position/Race",
        type: "text",
        placeholder: "e.g., Senate Majority",
        required: true,
      },
      {
        name: "electionDate",
        label: "Election Date",
        type: "date",
        required: true,
      },
    ],
    questionPattern: "Will {candidate} win {position} in the {electionDate} election?",
  },
  {
    id: "finance_price_target",
    name: "Finance: Price Target",
    category: "Finance",
    fields: [
      {
        name: "asset",
        label: "Asset/Security",
        type: "text",
        placeholder: "e.g., Bitcoin, S&P 500",
        required: true,
      },
      {
        name: "priceTarget",
        label: "Price Target",
        type: "number",
        placeholder: "e.g., 100000",
        required: true,
      },
      {
        name: "targetDate",
        label: "Target Date",
        type: "date",
        required: true,
      },
    ],
    questionPattern: "Will {asset} reach ${priceTarget} by {targetDate}?",
  },
  {
    id: "custom_yesno",
    name: "Custom Yes/No Question",
    category: "Custom",
    fields: [
      {
        name: "question",
        label: "Yes/No Question",
        type: "text",
        placeholder: "Enter a clear yes/no question",
        required: true,
      },
      {
        name: "category",
        label: "Category",
        type: "select",
        options: ["Cricket", "Politics", "Finance", "Technology", "Sports", "Entertainment"],
        required: true,
      },
      {
        name: "expiryDate",
        label: "Market Expiry Date",
        type: "date",
        required: true,
      },
    ],
    questionPattern: "{question}",
  },
];
