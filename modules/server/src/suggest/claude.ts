import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { ClaudeFailed, ClaudeRefused } from '../errors.ts';

// One Claude call per run: Opus 5.5 at effort "high" (D8), structured JSON output, no fallback
// model (D18): a refusal is shown to the person with its reason and a Retry button.

export const model = 'claude-opus-5-5';

const answerSchema = z.object({
  suggestions: z.array(
    z.object({
      artist: z.string(),
      title: z.string(),
      // The other common spelling (romanized, English or original script), or null.
      artist_alt: z.string().nullable(),
      title_alt: z.string().nullable(),
      reason: z.string(),
      kind: z.enum(['close', 'wildcard']),
    }),
  ),
});

export type Suggestion = z.infer<typeof answerSchema>['suggestions'][number];

export type ClaudeAnswer = { suggestions: Suggestion[]; usage: { input: number; output: number } };

// Swappable in tests.
export type SuggestClient = { ask: (prompt: { system: string; user: string }) => Promise<ClaudeAnswer> };

const describeApiError = (error: unknown): ClaudeFailed => {
  if (error instanceof Anthropic.AuthenticationError) return new ClaudeFailed('Claude rejected the API key (ANTHROPIC_API_KEY).');

  if (error instanceof Anthropic.RateLimitError) return new ClaudeFailed('Claude is rate-limiting this API key. Try again in a minute.');

  if (error instanceof Anthropic.APIError) return new ClaudeFailed(`Claude API error ${error.status ?? ''}: ${error.message}`);

  return new ClaudeFailed(`Couldn't reach Claude: ${error instanceof Error ? error.message : String(error)}`);
};

export const createClaude = (apiKey: string | undefined): SuggestClient => {
  const client = apiKey ? new Anthropic({ apiKey }) : undefined;

  return {
    ask: async ({ system, user }) => {
      if (!client) throw new ClaudeFailed('No Claude API key: set ANTHROPIC_API_KEY in .env.');

      const response = await client.messages
        .parse({
          model,
          max_tokens: 16000,
          thinking: { type: 'adaptive' },
          output_config: { effort: 'high', format: zodOutputFormat(answerSchema) },
          system,
          messages: [{ role: 'user', content: user }],
        })
        .catch((error: unknown) => {
          throw describeApiError(error);
        });

      // Check the stop reason before reading anything: a refusal may come with no content.
      if (response.stop_reason === 'refusal') {
        throw new ClaudeRefused(response.stop_details?.category ?? null, response.stop_details?.explanation ?? null);
      }

      if (response.stop_reason === 'max_tokens' || !response.parsed_output) {
        throw new ClaudeFailed('Claude’s answer was cut off or unreadable. Please retry.');
      }

      return {
        suggestions: response.parsed_output.suggestions,
        usage: { input: response.usage.input_tokens, output: response.usage.output_tokens },
      };
    },
  };
};
