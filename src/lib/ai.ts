/*
 * The VITALS 2.0 chatbots are online only. Every question (except emergencies, which src/lib/firstAid.ts
 * answers instantly with fixed steps) goes to the "chat" Edge Function in the Vitals 2.0 Supabase project
 * (supabase/functions/chat), which asks Google Gemini with school-health instructions for that bot. The
 * function only answers signed-in users, and keeps each bot to its own topic. There is no offline library
 * and no local model.
 */
import { supabase } from "@/lib/supabase";

export type Turn = { role: "user" | "assistant"; content: string };

/** One reply from the online assistant for this bot, given the conversation so far, or null if it couldn't answer. */
export async function askCloud(bot: string, conversation: Turn[], checkup: string): Promise<string | null> {
  if (!supabase || !navigator.onLine) return null;
  try {
    const { data, error } = await supabase.functions.invoke("chat", {
      body: { bot, messages: conversation.slice(-12), checkup },
    });
    if (error) return null;
    const reply = (data as { reply?: string } | null)?.reply?.trim();
    return reply || null;
  } catch {
    return null;
  }
}
