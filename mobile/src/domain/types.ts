/** Модель урока — из прототипа (README «State Management», DESIGN.md §6). */

export type SubjectId = string;

export interface ExplainStep {
  type: 'explain';
  /** Кикер «ЗАЧЕМ · миссия…». */
  why: string;
  title: string;
  paras: string[];
  example: string;
  source: string;
}

interface PracticeBase {
  prompt: string;
  explain: string;
  /** Будущая LearningRecord. */
  recTitle: string;
  recNote: string;
  /** Текст, который «наговаривает» симулятор голоса в прототипе; в проде — реальный STT. */
  voice?: string;
}

export interface ChoiceStep extends PracticeBase {
  type: 'choice';
  options: string[];
  /** -1 — калибровка без правильного ответа (бейдж ПРИНЯТО). */
  correct: number;
}

export interface InputStep extends PracticeBase {
  type: 'input';
  placeholder: string;
  /** Группы синонимов: каждая группа должна встретиться хотя бы одним вариантом. Пусто — принимается любой текст. */
  tokens: string[][];
  answer: string;
}

export interface OrderStep extends PracticeBase {
  type: 'order';
  items: string[];
  /** Индексы items в правильном порядке. */
  correct: number[];
}

export interface FreeStep extends PracticeBase {
  type: 'free';
  placeholder: string;
  criteria: { t: string; keys: string[] }[];
}

export type LessonStep = ExplainStep | ChoiceStep | InputStep | OrderStep | FreeStep;
export type PracticeStep = Exclude<LessonStep, ExplainStep>;

export interface Lesson {
  name: string;
  level: string;
  lessonTitle?: string;
  steps: LessonStep[];
}

export type TopicKind = 'human' | 'lang' | 'tech' | 'soft' | 'gen';

export interface Mission {
  cur: string;
  /** Старые версии — только добавляются: «v1 · …». */
  hist: string[];
}

export interface CustomSubject {
  topic: string;
  focus: string;
  mission: string;
  ready: boolean;
}

export interface SubjectConfig {
  pause: boolean;
  dur: 3 | 5 | 10;
  lim: 10 | 20 | 50;
  diff: 'comfy' | 'edge';
  voice: boolean;
  vlang: 'ui' | 'lesson';
}

export const defaultSubjectConfig: SubjectConfig = { pause: false, dur: 5, lim: 20, diff: 'edge', voice: true, vlang: 'lesson' };
