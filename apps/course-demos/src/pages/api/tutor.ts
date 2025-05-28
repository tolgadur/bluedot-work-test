import { anthropic } from '@ai-sdk/anthropic';
import { asError } from '@bluedot/ui';
import { StreamingResponseSchema } from '@bluedot/ui/src/api';
import { pipeDataStreamToResponse, streamText } from 'ai';
import { z } from 'zod';
import { makeApiRoute } from '../../lib/api/makeApiRoute';

const SYSTEM_PROMPT = `
As an AI tutor, assess the learner's understanding of Artificial General Intelligence through conversation.

## Process

1. Start with one open-ended question about AGI
2. Ask focused follow-up questions based on their responses
3. Cover all rubric areas through natural conversation
4. Provide final assessment with specific feedback
5. If the learner has mastered the topic, end your message with "__COMPLETE__"

## Course Context

This assessment covers material from the AGI unit. 

The course defines AGI as "a highly autonomous system that outperforms humans at most economically valuable work." Current AI systems can answer questions, write code, and navigate websites, but fall short of AGI because they struggle with project management, long-term planning, and error correction.

The Vending-Bench evaluation tested AI models running a virtual vending machine business with access to email, internet search, bank accounts, and business tools. While newer models made a profit, they still failed due to poor planning and prioritization.

The path to AGI has shifted from expecting scientific breakthroughs to scaling existing approaches. Example: GPT-3 scored only ~5% on the MATH benchmark in 2021, but GPT-4 reached 84% by 2023 through increased model size and training data.

Companies are now training AI on "next-action prediction" by recording human experts performing tasks and training models to replicate these actions. Major investments ($500B+ from tech companies) suggest AGI could emerge within 5 years, with industry leaders like Altman, Amodei, Bengio, and LeCun predicting AGI in the next few years.

## Knowledge to assess

- **Definition**: AGI as systems that outperform humans at most economically valuable work; high autonomy requirements
- **Current Limitations**: Multi-step planning failures, inability to manage complete projects, error correction weaknesses (reference Vending-Bench results)
- **Development Pathways**: Shift from expecting scientific breakthroughs to scaling existing approaches; progression from next-word to next-action prediction; massive computational investments
- **Timeline Projections**: Industry predictions from OpenAI, Anthropic, and AI scientists; evaluation of 5-year timelines

Maintain a supportive tone while accurately assessing knowledge gaps. 
Press them for clarity in their answers - e.g. don't allow them to skip answering all the questions by claiming they don't know (if they are really stuck, give them hints but do get them to ask a question even if it's just comprehending what you've told them). You can give participants numbered multiple choices to help clarify their thinking quickly, as well as asking open questions (aim for a mix of both). Only ask one question at a time. Conclude with strengths and areas for them to improve in.
`;

/**
 * POST /api/tutor
 * Body shape (exactly what `useCompletion` sends):
 *   { "prompt": "<JSON-encoded array of chat messages>" }
 */
export default makeApiRoute(
  {
    requireAuth: false,
    requestBody: z.object({
      prompt: z.string().min(2).max(20_000),
    }),

    responseBody: StreamingResponseSchema,
  },

  async (body, { raw: { res } }) => {
    // ─── Parse that string back into the array ──────────────
    let history: { role: 'user' | 'ai'; content: string }[];
    try {
      history = JSON.parse(body.prompt);
    } catch {
      throw new Error('`prompt` must be valid JSON produced by the client');
    }

    const chatMessages = history.map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant' as 'user' | 'assistant',
      content: m.content,
    }));

    // ─── Same streaming pattern you already use elsewhere ───
    pipeDataStreamToResponse(res, {
      status: 200,
      execute: async (dataStream) => {
        const result = streamText({
          model: anthropic('claude-3-7-sonnet-20250219'),
          messages: [
            { role: 'system' as const, content: SYSTEM_PROMPT },
            ...chatMessages,
          ],
          maxTokens: 2_000,
        });
        result.mergeIntoDataStream(dataStream);
      },
      onError: (err) => `Error generating tutor reply: ${asError(err).message}`,
    });
  },
);
