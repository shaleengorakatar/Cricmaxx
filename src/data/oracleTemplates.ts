import { EventTemplate, StatOption } from "@/types/oracle";

export const eventTemplates: EventTemplate[] = [
  {
    id: "player_runs",
    name: "Will [PLAYER] score [THRESHOLD]+ runs?",
    pattern: "Will {player} score {threshold}+ runs in {match}?",
    category: "Cricket - Player Performance"
  },
  {
    id: "player_wickets",
    name: "Will [PLAYER] take [THRESHOLD]+ wickets?",
    pattern: "Will {player} take {threshold}+ wickets in {match}?",
    category: "Cricket - Player Performance"
  },
  {
    id: "team_win",
    name: "Will [TEAM] win the match?",
    pattern: "Will {team} win against {opponent} in {match}?",
    category: "Cricket - Match Result"
  },
  {
    id: "team_score",
    name: "Will [TEAM] score [THRESHOLD]+ runs?",
    pattern: "Will {team} score {threshold}+ runs in {match}?",
    category: "Cricket - Team Performance"
  }
];

export const statOptions: Record<string, StatOption[]> = {
  player_runs: [
    { value: "runs", label: "Total Runs", apiField: "batting.runs" },
    { value: "balls_faced", label: "Balls Faced", apiField: "batting.ballsFaced" },
    { value: "strike_rate", label: "Strike Rate", apiField: "batting.strikeRate" }
  ],
  player_wickets: [
    { value: "wickets", label: "Wickets Taken", apiField: "bowling.wickets" },
    { value: "runs_conceded", label: "Runs Conceded", apiField: "bowling.runs" },
    { value: "economy", label: "Economy Rate", apiField: "bowling.economy" }
  ],
  team_win: [
    { value: "match_result", label: "Match Result", apiField: "result.winner" }
  ],
  team_score: [
    { value: "total_runs", label: "Total Runs", apiField: "score.runs" },
    { value: "total_wickets", label: "Wickets Lost", apiField: "score.wickets" }
  ]
};

export const comparisonOperators = [
  { value: ">=", label: "Greater than or equal to (≥)" },
  { value: ">", label: "Greater than (>)" },
  { value: "==", label: "Equal to (=)" },
  { value: "<=", label: "Less than or equal to (≤)" },
  { value: "<", label: "Less than (<)" }
];
