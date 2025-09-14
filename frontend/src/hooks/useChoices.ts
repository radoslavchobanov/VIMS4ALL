import { useEffect, useState } from "react";
import { api } from "../lib/apiClient";

export type Choice = { value: string | number | null; display_name: string };

export function useChoices(endpoint: string, fields: string[]) {
  const [choices, setChoices] = useState<Record<string, Choice[]>>({});
  useEffect(() => {
    let mounted = true;
    api.options(endpoint).then((r) => {
      const post = r.data?.actions?.POST ?? {};
      const obj: Record<string, Choice[]> = {};
      fields.forEach((f) => (obj[f] = post?.[f]?.choices ?? []));
      if (mounted) setChoices(obj);
    }).catch(() => {});
    return () => { mounted = false; };
  }, [endpoint, fields.join("|")]);
  return choices;
}
