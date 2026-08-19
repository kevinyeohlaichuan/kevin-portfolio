import { z } from "astro/zod";

const emptyFormValue = (value: unknown) => value ?? "";

export const contactInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().max(254),
  topic: z.enum(["employment", "collaboration", "press", "other"]),
  message: z.string().trim().min(20).max(5_000),
  // Astro converts empty FormData fields to null before Zod validation.
  website: z.preprocess(emptyFormValue, z.string().max(200)),
  "cf-turnstile-response": z.preprocess(
    emptyFormValue,
    z.string().max(2_048),
  ),
});
