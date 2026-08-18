import { useEffect, useState } from "react";
import { api, type AnalyticsInsight, type AssistantReply, type InsightImportance } from "../api/client";
import { Alert } from "../components/ui/Alert";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { inputClassName } from "../components/ui/Field";
import { Page } from "../components/ui/Page";
import { PageHeader } from "../components/ui/PageHeader";
import { ar } from "../locales/ar";

type ChatItem =
  | { role: "user"; text: string }
  | { role: "assistant"; reply: AssistantReply };

const importanceTone: Record<InsightImportance, "danger" | "warn" | "muted"> = {
  HIGH: "danger",
  MEDIUM: "warn",
  LOW: "muted",
};

const importanceLabel: Record<InsightImportance, string> = {
  HIGH: ar.analytics.high,
  MEDIUM: ar.analytics.medium,
  LOW: ar.analytics.low,
};

export function AnalyticsPage() {
  const [insights, setInsights] = useState<AnalyticsInsight[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [question, setQuestion] = useState("");
  const [chat, setChat] = useState<ChatItem[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    const data = await api.analytics();
    setInsights(data.insights);
    setSuggestions(data.suggestedQuestions);
  }

  useEffect(() => {
    load().catch(() => setError(ar.dashboard.disconnected));
  }, []);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const data = await api.refreshAnalytics();
      setInsights(data.insights);
      setSuggestions(data.suggestedQuestions);
      setNotice(ar.analytics.refreshed);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : ar.dashboard.disconnected);
    } finally {
      setLoading(false);
    }
  }

  async function ask(nextQuestion: string) {
    const text = nextQuestion.trim();
    if (!text) {
      return;
    }

    setChat((current) => [...current, { role: "user", text }]);
    setQuestion("");
    setError("");
    try {
      const reply = await api.askAssistant(text);
      setChat((current) => [...current, { role: "assistant", reply }]);
    } catch (askError) {
      setError(askError instanceof Error ? askError.message : ar.dashboard.disconnected);
    }
  }

  return (
    <Page>
      <PageHeader
        title={ar.analytics.title}
        subtitle={ar.analytics.subtitle}
        actions={
          <Button onClick={refresh} disabled={loading}>
            {ar.analytics.refresh}
          </Button>
        }
      />

      {notice ? <Alert tone="ok">{notice}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="list-stack">
        {insights.length === 0 ? <p className="muted">{ar.analytics.empty}</p> : null}
        {insights.map((insight) => (
          <article key={insight.id} className="card insight-card">
            <div className="page-header">
              <h3 className="card-title">{insight.observation}</h3>
              <Badge tone={importanceTone[insight.importance]}>{importanceLabel[insight.importance]}</Badge>
            </div>
            <p className="muted">{insight.explanation}</p>
            <p>
              {ar.analytics.action}: {insight.suggestedAction}
            </p>
          </article>
        ))}
      </div>

      <Card title={ar.analytics.assistant}>
        <p className="muted">{ar.analytics.assistantHint}</p>

        <div className="toolbar">
          {suggestions.map((item) => (
            <Button key={item} variant="secondary" onClick={() => ask(item)}>
              {item}
            </Button>
          ))}
        </div>

        <div className="list-stack">
          {chat.map((item, index) =>
            item.role === "user" ? (
              <div key={`u-${index}`} className="chat-user">
                <p>
                  <span className="card-title">{ar.analytics.you}: </span>
                  {item.text}
                </p>
              </div>
            ) : (
              <div key={`a-${index}`} className="chat-assistant">
                <p>
                  <span className="card-title">{ar.analytics.assistantName}: </span>
                  {item.reply.answer}
                </p>
                {item.reply.facts.length > 0 ? (
                  <div className="list-stack">
                    <p className="card-title">{ar.analytics.factsUsed}</p>
                    {item.reply.facts.map((fact) => (
                      <p key={`${fact.label}-${fact.value}`} className="muted">
                        {fact.label}: {fact.value}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            ),
          )}
        </div>

        <div className="toolbar">
          <input
            className={inputClassName}
            value={question}
            placeholder={ar.analytics.questionPlaceholder}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                ask(question).catch(() => setError(ar.dashboard.disconnected));
              }
            }}
          />
          <Button onClick={() => ask(question)}>{ar.analytics.ask}</Button>
        </div>
      </Card>
    </Page>
  );
}
