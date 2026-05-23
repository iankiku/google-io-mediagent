import type { SuggestionAdapter } from "@assistant-ui/react";

export const zoeSuggestionAdapter: SuggestionAdapter = {
  generate: async () => [
    { prompt: "How did I sleep last night?" },
    { prompt: "What's my HRV trend this week?" },
    { prompt: "Suggest a light workout for today" },
    { prompt: "Any alerts from my connected devices?" },
  ],
};
