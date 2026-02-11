import {
  Activity,
  BadgeCheck,
  Captions,
  Download,
  Mic2,
  Shield,
  Sparkles,
  Timer,
  Video
} from "lucide-react";

export type LandingFeature = {
  title: string;
  description: string;
  icon: typeof Captions;
};

export type LandingStep = {
  title: string;
  description: string;
  icon: typeof Captions;
};

export const landingSteps: LandingStep[] = [
  {
    title: "Захват жестов",
    description: "Поток с камеры/видео приходит в pipeline как последовательность кадров.",
    icon: Video
  },
  {
    title: "Распознавание + текст",
    description:
      "Модель формирует частичные и финальные фразы, которые обновляются в реальном времени.",
    icon: Activity
  },
  {
    title: "Субтитры и экспорт",
    description: "Результат отображается как overlay и отдается в SRT/VTT или burn-in рендер.",
    icon: Download
  }
];

export const landingFeatures: LandingFeature[] = [
  {
    title: "Live subtitles overlay",
    description: "Полноэкранный режим с читаемыми субтитрами поверх видео-потока.",
    icon: Captions
  },
  {
    title: "Export SRT/VTT",
    description: "Выгрузка таймкодов и текста в стандартных форматах для монтажа.",
    icon: Download
  },
  {
    title: "Burn-in subtitles",
    description: "Визуальный стиль субтитров применяется прямо к видео (mock UI).",
    icon: Sparkles
  },
  {
    title: "Voiceover TTS",
    description: "Голосовой режим с выбором профиля озвучки для предпросмотра.",
    icon: Mic2
  },
  {
    title: "Profiles: Speed / Quality",
    description: "Быстрый отклик или более стабильный результат с мягким переключением.",
    icon: Timer
  },
  {
    title: "Status & confidence",
    description: "Индикаторы подключенности и уверенности распознавания по каждому сегменту.",
    icon: BadgeCheck
  }
];

export const privacyItems = [
  "UI показывает только демонстрационный поток и mock-данные.",
  "Никакой фактической отправки видео, камеры или аудио не выполняется.",
  "Настройки и история существуют только в состоянии текущей сессии интерфейса."
];

export const signLanguages = [
  "ASL",
  "BSL",
  "RSL",
  "UkrSL",
  "KSL",
  "JSL"
];

export const outputLanguages = [
  "English",
  "Русский",
  "Українська",
  "Español",
  "Deutsch",
  "Français"
];

export const profiles = ["Speed", "Quality"] as const;

export const voiceOptions = [
  { value: "nova", label: "Nova" },
  { value: "atlas", label: "Atlas" },
  { value: "echo", label: "Echo" }
];

export const pricingPlans = [
  {
    name: "Free",
    monthly: 0,
    yearly: 0,
    description: "Прототипы и быстрые проверки UX",
    cta: "Start for free",
    features: [
      "Live preview (mock)",
      "2 upload jobs/day",
      "SRT export",
      "Community support"
    ]
  },
  {
    name: "Pro",
    monthly: 24,
    yearly: 19,
    description: "Для команд, работающих с субтитрами ежедневно",
    cta: "Upgrade to Pro",
    highlighted: true,
    features: [
      "Unlimited jobs",
      "SRT + VTT export",
      "Subtitle style profiles",
      "Voiceover preview"
    ]
  },
  {
    name: "Studio",
    monthly: 89,
    yearly: 69,
    description: "Продакшн-пайплайны и крупные медиакоманды",
    cta: "Contact sales",
    features: [
      "Multi-project workspaces",
      "Priority queue",
      "Collaboration notes",
      "Dedicated onboarding"
    ]
  }
];

export const docsFaq = [
  {
    q: "Это реальный ML-пайплайн?",
    a: "Нет. В этом проекте полностью mock-функционал для демонстрации UX и навигации."
  },
  {
    q: "Можно ли загрузить файл и получить результат?",
    a: "Можно пройти весь UI-процесс, но обработка имитируется на фронте."
  },
  {
    q: "Что сейчас работает по-настоящему?",
    a: "Роутинг, анимации, формы, интерактивные controls и client-side экспорт текстовых файлов."
  }
];

export const aboutValues = [
  {
    title: "Clarity first",
    text: "Ставим читаемость субтитров и управляемость интерфейса выше визуального шума.",
    icon: Captions
  },
  {
    title: "Human-centered",
    text: "Делаем инструменты, которые сокращают фрикцию между жестами и текстом.",
    icon: Sparkles
  },
  {
    title: "Safe by design",
    text: "В демо-режиме без реальных медиа-потоков, только прозрачные mock-сценарии.",
    icon: Shield
  }
];
