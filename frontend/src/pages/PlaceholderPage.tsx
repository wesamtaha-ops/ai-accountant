import { Page } from "../components/ui/Page";
import { PageHeader } from "../components/ui/PageHeader";

type PlaceholderPageProps = {
  title: string;
  description: string;
};

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <Page>
      <PageHeader title={title} subtitle={description} />
    </Page>
  );
}
