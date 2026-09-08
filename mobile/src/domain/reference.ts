/** Справочник (Reference из брифа §5.3): сжатая суть, переживает уроки. */
export interface RefRow {
  /** Подраздел (mono-заголовок): «Настоящее», «III век»… */
  sec?: string;
  /** Термин (колонка 126px). */
  k: string;
  v: string;
  /** Помечена ошибкой из записей об усвоенном → бейдж ОШИБКА. */
  weak: boolean;
}

export interface Reference {
  id: string;
  subjectId: string;
  subjectName: string;
  /** Группа на вкладке: Грамматика / Цель / Глоссарий… */
  group: string;
  title: string;
  /** «обновлён после урока N». */
  updatedAfter: number;
  rows: RefRow[];
}
