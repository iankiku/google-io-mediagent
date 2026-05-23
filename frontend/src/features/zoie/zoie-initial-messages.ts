import type { ThreadMessageLike } from "@assistant-ui/react";

export const ZOIE_INITIAL_MESSAGES: ThreadMessageLike[] = [
  {
    role: "user",
    content: [
      {
        type: "text",
        text: "How am I doing today based on my recent sleep and activity data?",
      },
    ],
  },
  {
    role: "assistant",
    content: [
      {
        type: "text",
        text: "Your sleep score was 85 last night, indicating good recovery. However, your resting heart rate is slightly elevated compared to your baseline. I'd recommend a lighter workout today to let your body fully recover.",
      },
    ],
  },
  {
    role: "user",
    content: [
      {
        type: "text",
        text: "Sounds good. What kind of light workout would you suggest?",
      },
    ],
  },
];
