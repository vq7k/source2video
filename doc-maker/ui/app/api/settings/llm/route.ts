import { NextResponse } from "next/server";

import {
  readLLMRuntimeSettings,
  saveLLMRuntimeSettings,
  toLLMRuntimeSettingsView,
} from "@/lib/llm/settings";

export const runtime = "nodejs";

export async function GET() {
  const settings = await readLLMRuntimeSettings();
  return NextResponse.json({ settings: toLLMRuntimeSettingsView(settings) });
}

export async function PUT(request: Request) {
  const input = await request.json();
  const settings = await saveLLMRuntimeSettings(input);
  return NextResponse.json({ settings: toLLMRuntimeSettingsView(settings) });
}
