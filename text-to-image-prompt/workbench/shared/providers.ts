export const providerIds = ["deepseek", "openai"] as const;
export type ProviderId = (typeof providerIds)[number];
export const providers = {
  deepseek: {
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    keyUrl: "https://platform.deepseek.com/api_keys",
  },
  openai: {
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    keyUrl: "https://platform.openai.com/api-keys",
  },
} satisfies Record<
  ProviderId,
  { name: string; baseUrl: string; keyUrl: string }
>;
