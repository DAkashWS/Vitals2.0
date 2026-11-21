/*
 * The VITALS 2.0 chatbots are online only. Every question (except emergencies, which src/lib/firstAid.ts
 * answers instantly with fixed steps) goes to the "chat" Edge Function in the Vitals 2.0 Supabase project
 * (supabase/functions/chat), which asks Google Gemini with school-health instructions for that bot. The
 * function only answers signed-in users, and keeps each bot to its own topic. There is no offline library
 * and no local model.
 */
import { supabase } from "@/lib/supabase";

export type Turn = { role: "user" | "assistant"; content: string };

const TIMEOUT_MS = 11000;

/** One reply from the online assistant for this bot, given the conversation so far, or null if it couldn't answer. */
export async function askCloud(bot: string, conversation: Turn[], checkup: string): Promise<string | null> {
  if (!supabase || !navigator.onLine) return null;
  try {
    // never wait forever: the function gives up after ~9 s itself, and this is the backstop
    const call = supabase.functions.invoke("chat", { body: { bot, messages: conversation.slice(-12), checkup } });
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS));
    const res = await Promise.race([call, timeout]);
    if (!res) return null;
    const { data, error } = res;
    if (error) return null;
    const reply = (data as { reply?: string } | null)?.reply?.trim();
    return reply || null;
  } catch {
    return null;
  }
}
