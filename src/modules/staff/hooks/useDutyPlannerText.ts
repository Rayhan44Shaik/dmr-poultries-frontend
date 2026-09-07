import { useMemo } from 'react';
import { useI18n } from '../../../i18n';
import { dutyTranslator } from '../i18n/dutyPlannerCopy';

export function useDutyPlannerText() {
  const { language } = useI18n();
  const t = useMemo(() => dutyTranslator(language), [language]);
  return { language, t };
}
