"use client";

import { Dispatch, SetStateAction } from "react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { profiles, outputLanguages, signLanguages, voiceOptions } from "@/lib/mock/data";

type LiveSettingsState = {
  signLanguage: string;
  outputLanguage: string;
  subtitleSize: "S" | "M" | "L";
  subtitlePosition: "bottom" | "top";
  subtitleBg: boolean;
  profile: "Speed" | "Quality";
  voiceEnabled: boolean;
  voice: string;
  smoothness: number;
};

type LiveSettingsProps = {
  state: LiveSettingsState;
  setState: Dispatch<SetStateAction<LiveSettingsState>>;
};

export function LiveSettings({ state, setState }: LiveSettingsProps) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Sign language</Label>
        <Select
          value={state.signLanguage}
          onValueChange={(value) => setState((prev) => ({ ...prev, signLanguage: value }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {signLanguages.map((language) => (
              <SelectItem key={language} value={language}>
                {language}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Output language</Label>
        <Select
          value={state.outputLanguage}
          onValueChange={(value) => setState((prev) => ({ ...prev, outputLanguage: value }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {outputLanguages.map((language) => (
              <SelectItem key={language} value={language}>
                {language}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Subtitle size</Label>
          <Select
            value={state.subtitleSize}
            onValueChange={(value) =>
              setState((prev) => ({ ...prev, subtitleSize: value as "S" | "M" | "L" }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["S", "M", "L"] as const).map((size) => (
                <SelectItem key={size} value={size}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Position</Label>
          <Select
            value={state.subtitlePosition}
            onValueChange={(value) =>
              setState((prev) => ({ ...prev, subtitlePosition: value as "bottom" | "top" }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bottom">Bottom</SelectItem>
              <SelectItem value="top">Top</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] p-3">
        <Label htmlFor="subtitle-bg">Subtitle background</Label>
        <Switch
          id="subtitle-bg"
          checked={state.subtitleBg}
          onCheckedChange={(checked) => setState((prev) => ({ ...prev, subtitleBg: checked }))}
        />
      </div>

      <div className="space-y-2">
        <Label>Profile</Label>
        <Select
          value={state.profile}
          onValueChange={(value) =>
            setState((prev) => ({ ...prev, profile: value as "Speed" | "Quality" }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {profiles.map((profile) => (
              <SelectItem key={profile} value={profile}>
                {profile}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="voice-enabled">Voice</Label>
          <Switch
            id="voice-enabled"
            checked={state.voiceEnabled}
            onCheckedChange={(checked) =>
              setState((prev) => ({ ...prev, voiceEnabled: checked }))
            }
          />
        </div>
        <Select
          value={state.voice}
          onValueChange={(value) => setState((prev) => ({ ...prev, voice: value }))}
          disabled={!state.voiceEnabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select voice" />
          </SelectTrigger>
          <SelectContent>
            {voiceOptions.map((voice) => (
              <SelectItem key={voice.value} value={voice.value}>
                {voice.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Smoothness</span>
          <span>{state.smoothness}%</span>
        </div>
        <Slider
          min={0}
          max={100}
          step={1}
          value={[state.smoothness]}
          onValueChange={(value) => setState((prev) => ({ ...prev, smoothness: value[0] ?? 60 }))}
        />
      </div>
    </div>
  );
}

export type { LiveSettingsState };
