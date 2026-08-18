import { writeInsightsWithGemini } from "../ai/insightWriter.js";
import { answerAccountingQuestion, suggestedQuestions } from "../ai/assistant.js";
import { prisma } from "../lib/prisma.js";
import { collectAnalyticsFacts } from "./analyticsFacts.js";

export async function getAnalytics() {
  return refreshAnalytics();
}

export async function refreshAnalytics() {
  const facts = await collectAnalyticsFacts();
  const insights = await persistInsights(facts);
  return {
    currency: facts.currency,
    insights: insights.map(serializeInsight),
    suggestedQuestions: suggestedQuestions(),
  };
}

export async function askAssistant(question: string) {
  const facts = await collectAnalyticsFacts();
  return answerAccountingQuestion(question, facts);
}

async function persistInsights(facts: Awaited<ReturnType<typeof collectAnalyticsFacts>>) {
  const written = await writeInsightsWithGemini(facts);
  await prisma.$transaction(async (tx) => {
    await tx.aiInsight.deleteMany();
    if (written.length > 0) {
      await tx.aiInsight.createMany({ data: written });
    }
  });
  return prisma.aiInsight.findMany({ orderBy: { createdAt: "desc" } });
}

function serializeInsight(item: { id: string; observation: string; importance: string; explanation: string; suggestedAction: string }) {
  return {
    id: item.id,
    observation: item.observation,
    importance: item.importance,
    explanation: item.explanation,
    suggestedAction: item.suggestedAction,
  };
}
